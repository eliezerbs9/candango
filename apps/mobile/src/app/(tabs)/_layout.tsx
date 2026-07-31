// Bottom-tab navigator for the authenticated app. Monochrome icons; the active
// tab fills in and picks up the terracotta accent (iOS-standard pattern).
import { Tabs } from 'expo-router';

import { Icon, type IconName } from '@/components/Icon';
import { colors, fonts } from '@/theme';

function tabIcon(name: IconName) {
  const TabIcon = ({ focused, color }: { focused: boolean; color: string }) => (
    <Icon name={name} focused={focused} color={color} size={24} />
  );
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: { borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
        headerTintColor: colors.ink,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Deals', tabBarIcon: tabIcon('deals') }} />
      <Tabs.Screen name="contacts" options={{ title: 'Contacts', tabBarIcon: tabIcon('contacts') }} />
      <Tabs.Screen name="activities" options={{ title: 'Activities', tabBarIcon: tabIcon('activities') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('profile') }} />
    </Tabs>
  );
}
