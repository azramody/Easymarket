import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { View } from 'react-native';

import { MiniPlayer } from '@/components/mini-player';
import { useStore } from '@/lib/store';
import { colors, font } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (on: IconName, off: IconName) => ({ color, focused }: { color: unknown; focused: boolean }) => (
  <Ionicons name={focused ? on : off} size={22} color={String(color)} />
);

export default function TabsLayout() {
  const { profile } = useStore();
  if (!profile.onboarded) return <Redirect href="/onboarding" />;
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.ink,
          tabBarInactiveTintColor: colors.inkFaint,
          tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 84, paddingTop: 8 },
          sceneStyle: { backgroundColor: colors.bg },
        }}>
        <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('sunny', 'sunny-outline') }} />
        <Tabs.Screen name="topics" options={{ title: 'Topics', tabBarIcon: icon('color-palette', 'color-palette-outline') }} />
        <Tabs.Screen name="lily" options={{ title: 'Lily', tabBarIcon: icon('chatbubble-ellipses', 'chatbubble-ellipses-outline') }} />
        <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: icon('albums', 'albums-outline') }} />
      </Tabs>
      <MiniPlayer />
    </View>
  );
}
