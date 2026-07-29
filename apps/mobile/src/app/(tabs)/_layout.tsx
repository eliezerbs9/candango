// Bottom-tab navigator for the authenticated app. Emoji icons (no extra dep).
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { colors, fonts } from '@/theme';

function tabIcon(emoji: string) {
  const Icon = ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
  Icon.displayName = `TabIcon(${emoji})`;
  return Icon;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
        headerTintColor: colors.ink,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Deals', tabBarIcon: tabIcon('💼') }} />
      <Tabs.Screen name="contacts" options={{ title: 'Contacts', tabBarIcon: tabIcon('👥') }} />
      <Tabs.Screen name="activities" options={{ title: 'Activities', tabBarIcon: tabIcon('📅') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('👤') }} />
    </Tabs>
  );
}
