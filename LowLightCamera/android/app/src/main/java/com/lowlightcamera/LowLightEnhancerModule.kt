package com.lowlightcamera

import android.app.ActivityManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.util.Base64
import android.util.Log
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.*
import ai.onnxruntime.*
import kotlinx.coroutines.*
import java.nio.FloatBuffer
import java.io.ByteArrayOutputStream
import java.util.concurrent.atomic.AtomicBoolean

class LowLightEnhancerModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {
    
    private var ortSession: OrtSession? = null
    private val ortEnvironment = OrtEnvironment.getEnvironment()
    
    private val TAG = "LowLightEnhancer"
    
    // 해상도 유지
    private val MAX_WIDTH = 512
    private val MAX_HEIGHT = 384
    
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private val isProcessing = AtomicBoolean(false)
    
    // Temporal smoothing
    private var previousEnhancedPixels: IntArray? = null
    private var previousWidth = 0
    private var previousHeight = 0
    private val SMOOTHING_ALPHA = 0.7f
    
    override fun getName(): String {
        return "LowLightEnhancer"
    }
    
    @ReactMethod
    fun loadModel(promise: Promise) {
        scope.launch {
            try {
                val modelBytes = reactApplicationContext.assets.open("iat_static_uint8.onnx").readBytes()
                val sessionOptions = OrtSession.SessionOptions()
                
                // 🔧 NNAPI 시도 (호환성 있는 방식)
                var deviceType = "CPU"
                try {
                    sessionOptions.addNnapi()
                    deviceType = "NNAPI"
                    Log.d(TAG, "✅ NNAPI enabled")
                } catch (e: Exception) {
                    // 🔧 CPU 최적화 강화
                    sessionOptions.setIntraOpNumThreads(8)  // 6 → 8
                    sessionOptions.setInterOpNumThreads(4)  // 3 → 4
                    deviceType = "CPU (Optimized)"
                    Log.d(TAG, "⚠️ NNAPI failed, using CPU optimization")
                }
                
                // 🔧 PARALLEL 모드
                sessionOptions.setExecutionMode(OrtSession.SessionOptions.ExecutionMode.PARALLEL)
                sessionOptions.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
                
                ortSession = ortEnvironment.createSession(modelBytes, sessionOptions)
                
                Log.d(TAG, "✅ Model loaded on $deviceType (${MAX_WIDTH}x${MAX_HEIGHT})")
                
                withContext(Dispatchers.Main) {
                    promise.resolve("Model loaded on $deviceType")
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Model load failed: ${e.message}")
                withContext(Dispatchers.Main) {
                    promise.reject("LOAD_ERROR", "Failed to load model: ${e.message}")
                }
            }
        }
    }

    @ReactMethod
    fun enhanceImage(imagePath: String, promise: Promise) {
        if (!isProcessing.compareAndSet(false, true)) {
            promise.reject("BUSY", "Already processing")
            return
        }
        
        scope.launch {
            val startTime = System.currentTimeMillis()
            var bitmap: Bitmap? = null
            var enhancedBitmap: Bitmap? = null
            var inputTensor: OnnxTensor? = null
            var outputs: OrtSession.Result? = null
            var inputBuffer: FloatBuffer? = null
            
            try {
                if (ortSession == null) {
                    withContext(Dispatchers.Main) {
                        promise.reject("MODEL_ERROR", "Model not loaded")
                    }
                    return@launch
                }
                
                // STEP 1: 이미지 로드
                bitmap = loadBitmapWithOrientation(imagePath)
                
                if (bitmap == null) {
                    withContext(Dispatchers.Main) {
                        promise.reject("IMAGE_ERROR", "Failed to load image")
                    }
                    return@launch
                }
                
                bitmap = ensureMaxDimensions(bitmap, MAX_WIDTH, MAX_HEIGHT)
                
                val width = bitmap.width
                val height = bitmap.height
                
                // STEP 2: Float 변환
                val inputArray = bitmapToFloatArrayOptimized(bitmap)
                inputBuffer = FloatBuffer.wrap(inputArray)
                
                // STEP 3: 모델 추론
                val inferenceStart = System.currentTimeMillis()
                val shape = longArrayOf(1, 3, height.toLong(), width.toLong())
                inputTensor = OnnxTensor.createTensor(ortEnvironment, inputBuffer, shape)
                val inputs = mapOf("input" to inputTensor)
                
                outputs = ortSession!!.run(inputs)
                val inferenceTime = System.currentTimeMillis() - inferenceStart
                
                val outputIndex = outputs.size() - 1
                val outputTensor = outputs[outputIndex].value as Array<Array<Array<FloatArray>>>
                
                // STEP 4: Bitmap 변환 + Temporal Smoothing
                enhancedBitmap = floatArrayToBitmapWithSmoothing(outputTensor[0], width, height)
                
                // STEP 5: Base64 인코딩 (🔧 품질 50)
                val base64 = bitmapToBase64(enhancedBitmap, quality = 50)
                
                val totalTime = System.currentTimeMillis() - startTime
                Log.d(TAG, "✅ ${totalTime}ms (추론: ${inferenceTime}ms)")
                
                withContext(Dispatchers.Main) {
                    promise.resolve(base64)
                }
                
            } catch (e: OutOfMemoryError) {
                Log.e(TAG, "❌ OOM")
                withContext(Dispatchers.Main) {
                    promise.reject("MEMORY_ERROR", "Out of memory")
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error: ${e.message}")
                withContext(Dispatchers.Main) {
                    promise.reject("ENHANCE_ERROR", e.message)
                }
            } finally {
                inputTensor?.close()
                outputs?.close()
                bitmap?.recycle()
                enhancedBitmap?.recycle()
                inputBuffer?.clear()
                isProcessing.set(false)
            }
        }
    }
    
    private fun floatArrayToBitmapWithSmoothing(
        data: Array<Array<FloatArray>>, 
        width: Int, 
        height: Int
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val pixels = IntArray(width * height)
        
        var idx = 0
        for (y in 0 until height) {
            for (x in 0 until width) {
                val r = (data[0][y][x].coerceIn(0f, 1f) * 255f).toInt()
                val g = (data[1][y][x].coerceIn(0f, 1f) * 255f).toInt()
                val b = (data[2][y][x].coerceIn(0f, 1f) * 255f).toInt()
                
                val currentPixel = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
                
                if (previousEnhancedPixels != null && 
                    previousWidth == width && 
                    previousHeight == height) {
                    
                    val prevPixel = previousEnhancedPixels!![idx]
                    
                    val prevR = (prevPixel shr 16) and 0xFF
                    val prevG = (prevPixel shr 8) and 0xFF
                    val prevB = prevPixel and 0xFF
                    
                    val smoothedR = (SMOOTHING_ALPHA * r + (1 - SMOOTHING_ALPHA) * prevR).toInt()
                    val smoothedG = (SMOOTHING_ALPHA * g + (1 - SMOOTHING_ALPHA) * prevG).toInt()
                    val smoothedB = (SMOOTHING_ALPHA * b + (1 - SMOOTHING_ALPHA) * prevB).toInt()
                    
                    pixels[idx] = (0xFF shl 24) or (smoothedR shl 16) or (smoothedG shl 8) or smoothedB
                } else {
                    pixels[idx] = currentPixel
                }
                
                idx++
            }
        }
        
        previousEnhancedPixels = pixels.clone()
        previousWidth = width
        previousHeight = height
        
        bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
        return bitmap
    }
    
    private fun loadBitmapWithOrientation(imagePath: String): Bitmap? {
        val exif = ExifInterface(imagePath)
        val orientation = exif.getAttributeInt(
            ExifInterface.TAG_ORIENTATION,
            ExifInterface.ORIENTATION_NORMAL
        )
        
        val inSampleSize = calculateOptimalInSampleSize(imagePath, MAX_WIDTH, MAX_HEIGHT)
        val options = BitmapFactory.Options().apply {
            inPreferredConfig = Bitmap.Config.ARGB_8888
            inMutable = false
            this.inSampleSize = inSampleSize
        }
        
        var bitmap = BitmapFactory.decodeFile(imagePath, options) ?: return null
        
        val rotationAngle = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90
            ExifInterface.ORIENTATION_ROTATE_180 -> 180
            ExifInterface.ORIENTATION_ROTATE_270 -> 270
            else -> 0
        }
        
        if (rotationAngle != 0) {
            bitmap = rotateBitmap(bitmap, rotationAngle.toFloat())
        }
        
        return bitmap
    }
    
    private fun rotateBitmap(source: Bitmap, angle: Float): Bitmap {
        val matrix = Matrix().apply {
            postRotate(angle)
        }
        
        val rotated = Bitmap.createBitmap(
            source, 0, 0, 
            source.width, source.height, 
            matrix, true
        )
        
        if (rotated != source) {
            source.recycle()
        }
        
        return rotated
    }
    
    private fun calculateOptimalInSampleSize(path: String, reqWidth: Int, reqHeight: Int): Int {
        val options = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        BitmapFactory.decodeFile(path, options)
        
        val height = options.outHeight
        val width = options.outWidth
        
        if (height <= reqHeight && width <= reqWidth) {
            return 1
        }
        
        val heightRatio = height.toFloat() / reqHeight
        val widthRatio = width.toFloat() / reqWidth
        val maxRatio = maxOf(heightRatio, widthRatio)
        
        var inSampleSize = 1
        while (inSampleSize * 2 < maxRatio) {
            inSampleSize *= 2
        }
        
        return inSampleSize
    }
    
    private fun ensureMaxDimensions(bitmap: Bitmap, maxWidth: Int, maxHeight: Int): Bitmap {
        if (bitmap.width <= maxWidth && bitmap.height <= maxHeight) {
            return bitmap
        }
        
        val scale = minOf(
            maxWidth.toFloat() / bitmap.width,
            maxHeight.toFloat() / bitmap.height
        )
        
        val targetWidth = (bitmap.width * scale).toInt()
        val targetHeight = (bitmap.height * scale).toInt()
        
        val resized = Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
        bitmap.recycle()
        return resized
    }
    
    private fun bitmapToFloatArrayOptimized(bitmap: Bitmap): FloatArray {
        val width = bitmap.width
        val height = bitmap.height
        val totalPixels = width * height
        
        val pixels = IntArray(totalPixels)
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
        
        val floatArray = FloatArray(totalPixels * 3)
        val scale = 0.00392156862745098f
        
        for (i in pixels.indices) {
            val pixel = pixels[i]
            
            floatArray[i] = ((pixel shr 16) and 0xFF) * scale
            floatArray[i + totalPixels] = ((pixel shr 8) and 0xFF) * scale
            floatArray[i + totalPixels * 2] = (pixel and 0xFF) * scale
        }
        
        return floatArray
    }
    
    // 🔧 Base64 최적화
    private fun bitmapToBase64(bitmap: Bitmap, quality: Int = 50): String {
        // 예상 크기로 초기화 (메모리 재할당 방지)
        val estimatedSize = (bitmap.width * bitmap.height * 3 * quality / 100)
        val outputStream = ByteArrayOutputStream(estimatedSize)
        
        bitmap.compress(Bitmap.CompressFormat.JPEG, quality, outputStream)
        val byteArray = outputStream.toByteArray()
        return Base64.encodeToString(byteArray, Base64.NO_WRAP)
    }
    
    @ReactMethod
    fun resetSmoothing(promise: Promise) {
        previousEnhancedPixels = null
        previousWidth = 0
        previousHeight = 0
        promise.resolve("Smoothing reset")
    }
    
    @ReactMethod
    fun cleanup(promise: Promise) {
        scope.launch {
            try {
                ortSession?.close()
                ortSession = null
                previousEnhancedPixels = null
                Log.d(TAG, "✅ Cleanup complete")
                withContext(Dispatchers.Main) {
                    promise.resolve("Cleanup complete")
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Cleanup failed: ${e.message}")
                withContext(Dispatchers.Main) {
                    promise.reject("CLEANUP_ERROR", "${e.message}")
                }
            }
        }
    }
    
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        scope.cancel()
        ortSession?.close()
    }
}