import React, {useState, useCallback, useEffect} from 'react';
import {View, StyleSheet, Text} from 'react-native';
import CameraView from '../components/CameraView';
import ControlButtons from '../components/ControlButtons';
import StatusBar from '../components/StatusBar';
import {NativeModules} from 'react-native';

const {LowLightEnhancer} = NativeModules;

const CameraScreen = (): React.JSX.Element => {
  const [isRecording, setIsRecording] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);

  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log('Loading ONNX model...');
        const result = await LowLightEnhancer.loadModel();
        console.log('Model loaded:', result);
        setModelLoaded(true);
      } catch (error) {
        console.error('Failed to load model:', error);
      }
    };

    loadModel();
  }, []);
  
  const handleToggleEnhancement = useCallback(() => {
    if (!modelLoaded) {
      console.warn('Model not loaded yet');
      return;
    }
    setIsEnhancing(prev => !prev);
    console.log('Enhancement toggled:', !isEnhancing);
  }, [isEnhancing, modelLoaded]);

  const handleCapture = useCallback(() => {
    console.log('Capture photo');
    // TODO: 사진 캡처 로직
  }, []);

  const handleSwitchCamera = useCallback(() => {
    console.log('Switch camera');
    // TODO: 전면/후면 카메라 전환
  }, []);

  return (
    <View style={styles.container}>
      {/* Status Bar - FPS, Latency 표시 */}
      <StatusBar
        fps={fps}
        latency={latency}
        isEnhancing={isEnhancing}
      />

      {/* Camera View */}
      <CameraView
        isEnhancing={isEnhancing}
        onFrameProcessed={(processingTime) => {
          setLatency(processingTime);
          if (processingTime > 0) {
            setFps(Math.round(1000 / processingTime));
          }
        }}
      />

      {/* Control Buttons */}
      <ControlButtons
        isEnhancing={isEnhancing}
        onToggleEnhancement={handleToggleEnhancement}
        onCapture={handleCapture}
        onSwitchCamera={handleSwitchCamera}
      />

      {/* Enhancement Indicator */}
      {isEnhancing && (
        <View style={styles.enhancementIndicator}>
          <View style={styles.indicatorDot} />
          <Text style={styles.enhancementText}>AI Enhancement ON</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  enhancementIndicator: {
    position: 'absolute',
    top: 80,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00ff00',
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00ff00',
    marginRight: 8,
  },
  enhancementText: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default CameraScreen;