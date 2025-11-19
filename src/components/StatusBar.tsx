import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

interface StatusBarProps {
  fps: number;
  latency: number;
  isEnhancing: boolean;
}

const StatusBar = ({
  fps,
  latency,
  isEnhancing,
}: StatusBarProps): React.JSX.Element => {
  const getFpsColor = (fps: number): string => {
    if (fps >= 25) return '#00ff00';
    if (fps >= 15) return '#ffff00';
    return '#ff0000';
  };

  const getLatencyColor = (latency: number): string => {
    if (latency <= 33) return '#00ff00';
    if (latency <= 66) return '#ffff00';
    return '#ff0000';
  };

  return (
    <View style={styles.container}>
      <View style={styles.metricsContainer}>
        {/* FPS Display */}
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>FPS</Text>
          <Text style={[styles.metricValue, {color: getFpsColor(fps)}]}>
            {fps > 0 ? fps : '--'}
          </Text>
        </View>

        {/* Latency Display */}
        {isEnhancing && (
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Latency</Text>
            <Text style={[styles.metricValue, {color: getLatencyColor(latency)}]}>
              {latency > 0 ? `${latency}ms` : '--'}
            </Text>
          </View>
        )}
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
    paddingTop: 16,
    paddingHorizontal: 20,
    zIndex: 100,
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  metric: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
  },
  metricLabel: {
    color: '#aaaaaa',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  modelInfo: {
    marginTop: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  modelText: {
    color: '#00ff00',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default StatusBar;