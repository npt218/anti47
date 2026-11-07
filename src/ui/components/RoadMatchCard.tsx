import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RoadMatchResult } from '../../types/osm';

interface RoadMatchCardProps {
  match: RoadMatchResult | null;
}

export const RoadMatchCard: React.FC<RoadMatchCardProps> = ({ match }) => {
  if (!match || !match.matched || !match.segment) {
    return (
      <View style={styles.container}>
        <View style={styles.unmatchedRow}>
          <View style={styles.searchingDot} />
          <Text style={styles.searchingText}>SNAPPING TO OFFLINE ROAD...</Text>
        </View>
      </View>
    );
  }

  const { segment, distanceMeters, confidence } = match;

  const getHighwayBadgeColor = () => {
    switch (segment.highway) {
      case 'motorway':
      case 'trunk':
        return { bg: '#8957E5', text: '#FFFFFF' };
      case 'primary':
        return { bg: '#1F6FEB', text: '#FFFFFF' };
      case 'secondary':
        return { bg: '#388BFD', text: '#FFFFFF' };
      case 'residential':
      default:
        return { bg: '#30363D', text: '#8B949E' };
    }
  };

  const badge = getHighwayBadgeColor();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.roadName} numberOfLines={1}>
          {segment.name}
        </Text>
        <View style={[styles.highwayBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.highwayBadgeText, { color: badge.text }]}>
            {segment.highway.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>
            {segment.carriageway === 'dual' ? 'DIVIDED (ĐÔI)' : 'UNDIVIDED (2 CHIỀU)'}
          </Text>
        </View>

        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>
            {segment.area === 'urban' ? 'ĐÔ THỊ' : 'NGOÀI ĐÔ THỊ'}
          </Text>
        </View>

        <Text style={styles.offsetText}>
          {distanceMeters}m off-center ({Math.round(confidence * 100)}%)
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#161B22',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363D',
    marginVertical: 8,
  },
  unmatchedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  searchingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D29922',
  },
  searchingText: {
    color: '#8B949E',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  roadName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F0F6FC',
    flex: 1,
    marginRight: 8,
  },
  highwayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  highwayBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    backgroundColor: '#21262D',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  metaPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C9D1D9',
  },
  offsetText: {
    fontSize: 11,
    color: '#8B949E',
    marginLeft: 'auto',
  },
});
