import React, {useEffect, useRef, useState} from 'react';
import {View, StyleSheet, Text, NativeModules, Image} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
} from 'react-native-vision-camera';

const {LowLightEnhancer} = NativeModules;

interface CameraViewProps {
  isEnhancing: boolean;
  onFrameProcessed?: (processingTime: number) => void;
}

const CameraView = ({
  isEnhancing,
  onFrameProcessed,
}: CameraViewProps): React.JSX.Element => {
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);
  
  const format = useCameraFormat(device, [
    {fps: 30},
    {photoResolution: {width: 1280, height: 960}},
    {videoResolution: {width: 1280, height: 720}},
  ]);

  useEffect(() => {
    const requestPermissions = async () => {
      await Camera.requestCameraPermission();
      await Camera.requestMicrophonePermission();
    };
    requestPermissions();
  }, []);

  useEffect(() => {
    if (!isEnhancing || !camera.current) {
      setEnhancedImage(null);
      setProcessingTime(0);
      LowLightEnhancer.resetSmoothing?.();
      return;
    }
    
    let isProcessing = false;
    
    const processFrame = async () => {
      if (isProcessing) return;
      
      isProcessing = true;
      const startTime = Date.now();
      
      try {
        const photo = await camera.current?.takePhoto({
          qualityPrioritization: 'speed',
          skipMetadata: true,
          flash: 'off',
        });
        
        if (!photo) {
          isProcessing = false;
          return;
        }
        
        const base64 = await LowLightEnhancer.enhanceImage(photo.path);
        
        if (base64 && base64.length > 0) {
          const newImageUri = `data:image/jpeg;base64,${base64}`;
          setEnhancedImage(newImageUri);
        }
        
        const latency = Date.now() - startTime;
        setProcessingTime(latency);
        
        console.log(`⚡ ${latency}ms`);
        
        if (onFrameProcessed) {
          onFrameProcessed(latency);
        }
      } catch (error: any) {
        if (error?.message !== 'BUSY') {
          console.error('❌', error?.message);
        }
      }
      
      isProcessing = false;
    };
    
    const interval = setInterval(processFrame, 1200);
    processFrame();
    
    return () => {
      clearInterval(interval);
    };
  }, [isEnhancing, onFrameProcessed]);

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>카메라를 찾을 수 없습니다</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 🔧 Enhanced 모드가 아닐 때만 카메라 프리뷰 */}
      {!isEnhancing && (
        <Camera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          format={format}
          pixelFormat="yuv"
          photo={true}
          enableBufferCompression={true}
        />
      )}

      {/* 🔧 Enhanced 모드일 때는 카메라 백그라운드에서만 작동 */}
      {isEnhancing && (
        <>
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            format={format}
            pixelFormat="yuv"
            photo={true}
            enableBufferCompression={true}
          />
          
          {/* Enhanced 이미지만 보여줌 */}
          {enhancedImage && (
            <Image
              source={{uri: enhancedImage}}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              pointerEvents="none"
            />
          )}
        </>
      )}

      <View style={styles.overlay}>
        <View style={styles.focusFrame} />
        
        {/* {isEnhancing && processingTime > 0 && (
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              ⚡ {(processingTime / 1000).toFixed(2)}s
            </Text>
          </View>
        )} */}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  errorText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  focusFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
  },
  statsContainer: {
    position: 'absolute',
    top: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  statsText: {
    color: '#00FF00',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default CameraView;