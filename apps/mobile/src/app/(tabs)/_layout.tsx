// Bottom-tab navigator for the authenticated app: Deals, Contacts, Activities,
// Profile. Icons are emoji to avoid an extra icon dependency.
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

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
        tabBarActiveTintColor: '#d9552c',
        headerTitleStyle: { color: '#18181b' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Deals', tabBarIcon: tabIcon('💼') }} />
      <Tabs.Screen name="contacts" options={{ title: 'Contacts', tabBarIcon: tabIcon('👥') }} />
      <Tabs.Screen name="activities" options={{ title: 'Activities', tabBarIcon: tabIcon('📅') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('👤') }} />
    </Tabs>
  );
}
