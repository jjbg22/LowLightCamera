import React from 'react';
import {View, TouchableOpacity, StyleSheet, Text} from 'react-native';

interface ControlButtonsProps {
  isEnhancing: boolean;
  onToggleEnhancement: () => void;
  onCapture: () => void;
  onSwitchCamera: () => void;
}

const ControlButtons = ({
  isEnhancing,
  onToggleEnhancement,
  onCapture,
  onSwitchCamera,
}: ControlButtonsProps): React.JSX.Element => {
  return (
    <View style={styles.container}>
      {/* Bottom Controls */}
      <View style={styles.bottomControls}>

        {/* 중앙 Enhancement 토글 버튼 */}
        <View style={styles.captureButtonContainer}>
          <TouchableOpacity
            style={[
              styles.captureButton,
              isEnhancing && styles.captureButtonActive,
            ]}
            onPress={onToggleEnhancement}>
            <View
              style={[
                styles.captureButtonInner,
                isEnhancing && styles.captureButtonInnerActive,
              ]}>
              <Text style={styles.captureButtonText}>
                {isEnhancing ? '★' : '☆'}
              </Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.captureHint}>
            {isEnhancing ? 'Enhancement ON' : 'Tap to Enhance'}
          </Text>
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    pointerEvents: 'box-none',
  },
  captureButtonContainer: {
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
  },
  captureButtonActive: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInnerActive: {
    backgroundColor: '#FFD700',
  },
  captureButtonText: {
    fontSize: 32,
    color: '#000000',
  },
  captureHint: {
    color: '#ffffff',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  secondaryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonIcon: {
    fontSize: 24,
  },
});

export default ControlButtons;