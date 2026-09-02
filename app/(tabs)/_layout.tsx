import React from 'react';

import {
  Tabs,
} from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: 'none',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
        }}
      />

      <Tabs.Screen
        name="loans"
        options={{
          title: 'Loans',
        }}
      />

      <Tabs.Screen
        name="calculator"
        options={{
          title: 'Calculator',
        }}
      />

      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
        }}
      />

      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
        }}
      />
    </Tabs>
  );
}