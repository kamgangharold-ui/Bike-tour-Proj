import { Tabs, router, type Href } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#1E1E1E' },
        headerTintColor: '#fff',
        tabBarStyle: { backgroundColor: '#1E1E1E', borderTopColor: '#333' },
        tabBarActiveTintColor: '#00C853',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ride"
        options={{
          title: 'Ride',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bicycle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="parking"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'BikAI',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/settings' as Href)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="settings-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
