import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, User, Check, BookOpen, FileText } from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import { MenuProvider } from "react-native-popup-menu";

import HomeScreen from "./screens/HomeScreen";
import KrsScreen from "./screens/KrsScreen";
import KpuScreen from "./screens/KpuScreen";
import ProfileScreen from "./screens/ProfileScreen";

// Splash screen auto-hides now - no blocking

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const API_URL = "http://188.166.234.77:3000";

// Dark Theme
const AppDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#0F0F0F",
    card: "#0F0F0F",
    border: "#1A1A1A",
  },
};

// Dashboard Tabs
function DashboardTabs({ route }) {
  const params = route.params || {};

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0F0F0F",
          borderTopColor: "#1A1A1A",
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#FFF",
        tabBarInactiveTintColor: "#666",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        initialParams={params}
        options={{
          tabBarLabel: "Beranda",
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size - 4} />
          ),
        }}
      />
      <Tab.Screen
        name="Krs"
        component={KrsScreen}
        initialParams={params}
        options={{
          tabBarLabel: "KRS",
          tabBarIcon: ({ color, size }) => (
            <BookOpen color={color} size={size - 4} />
          ),
        }}
      />
      <Tab.Screen
        name="Kpu"
        component={KpuScreen}
        initialParams={params}
        options={{
          tabBarLabel: "KPU",
          tabBarIcon: ({ color, size }) => (
            <FileText color={color} size={size - 4} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        initialParams={params}
        options={{
          tabBarLabel: "Profil",
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size - 4} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Login Screen
function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  // Check saved credentials on mount - runs in background, doesn't block UI
  useEffect(() => {
    checkSavedCredentials(); // Check login in background (won't block)
  }, []);

  const checkSavedCredentials = async () => {
    try {
      const saved = await SecureStore.getItemAsync("saved_credentials");
      if (saved) {
        const { email: savedEmail, password: savedPassword } =
          JSON.parse(saved);
        if (savedEmail && savedPassword) {
          setEmail(savedEmail);
          setPassword(savedPassword);
          setRememberMe(true);
          // Try auto login in background with timeout
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 5000);
          try {
            const response = await fetch(`${API_URL}/api/login`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: savedEmail,
                password: savedPassword,
              }),
              signal: controller.signal,
            });
            const data = await response.json();
            if (data.success) {
              navigation.replace("Dashboard", {
                user: data.user,
                cookies: data.user.cookies || "",
                redirectUrl: data.user.redirectUrl || "/dashboardMhs",
              });
              return; // Exit early if auto login successful
            }
          } catch (e) {
            console.log("Auto login failed");
          }
        }
      }
    } catch (e) {
      console.log("No saved credentials");
    }
  };

  const doLogin = async (loginEmail, loginPassword, isAutoLogin = false) => {
    if (!isAutoLogin) setLoading(true);

    try {
      // Add timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout
      
      const response = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        // Save credentials if remember me is checked
        if (rememberMe || isAutoLogin) {
          await SecureStore.setItemAsync(
            "saved_credentials",
            JSON.stringify({ email: loginEmail, password: loginPassword }),
          );
        }

        navigation.replace("Dashboard", {
          user: data.user,
          cookies: data.user.cookies || "",
          redirectUrl: data.user.redirectUrl || "/dashboardMhs",
        });
      } else {
        if (!isAutoLogin) {
          Alert.alert(
            "Gagal Login",
            data.message || "Email atau Password salah.",
          );
        }
        // Clear saved credentials on failed auto-login
        if (isAutoLogin) {
          await SecureStore.deleteItemAsync("saved_credentials");
        }
      }
    } catch (error) {
      console.log("Login error:", error);
      if (!isAutoLogin) {
        if (error.name === "AbortError") {
          Alert.alert("Timeout", "Koneksi terlalu lambat. Coba lagi.");
        } else {
          Alert.alert("Koneksi Gagal", "Tidak bisa terhubung ke server.\n\nError: " + error.message);
        }
      }
    } finally {
      if (!isAutoLogin) setLoading(false);
    }
  };

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert("Error", "Email dan Password wajib diisi!");
      return;
    }
    doLogin(email, password);
  };

  const toggleRememberMe = async () => {
    const newValue = !rememberMe;
    setRememberMe(newValue);
    if (!newValue) {
      await SecureStore.deleteItemAsync("saved_credentials");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0F0F0F" />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.header}>
          <Text style={styles.title}>SIKAMU UMB</Text>
          <Text style={styles.subtitle}>Portal Akademik Mahasiswa</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="Masukkan email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Masukkan password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {/* Remember Me */}
          <TouchableOpacity
            style={styles.rememberRow}
            onPress={toggleRememberMe}
          >
            <View
              style={[styles.checkbox, rememberMe && styles.checkboxChecked]}
            >
              {rememberMe && <Check color="#0F0F0F" size={14} />}
            </View>
            <Text style={styles.rememberText}>Ingat Saya</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>Masuk</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>© 2026 SIKAMU Mobile</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Main App
export default function App() {
  return (
    <MenuProvider>
      <NavigationContainer theme={AppDarkTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DashboardTabs} />
        </Stack.Navigator>
      </NavigationContainer>
    </MenuProvider>
  );
}

const styles = StyleSheet.create({
  // Login
  container: { flex: 1, backgroundColor: "#0F0F0F" },
  scrollContainer: { flexGrow: 1, justifyContent: "center", padding: 24 },
  header: { alignItems: "center", marginBottom: 48 },
  logoImage: { width: 100, height: 100, borderRadius: 24, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "700", color: "#FFF", letterSpacing: 2 },
  subtitle: { fontSize: 13, color: "#666", marginTop: 6 },
  form: {
    backgroundColor: "#1A1A1A",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    color: "#888",
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    backgroundColor: "#0F0F0F",
    color: "#FFF",
    fontSize: 15,
  },
  rememberRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#444",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  checkboxChecked: { backgroundColor: "#FFF", borderColor: "#FFF" },
  rememberText: { color: "#888", fontSize: 14 },
  button: {
    backgroundColor: "#FFF",
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { backgroundColor: "#333" },
  buttonText: { color: "#0F0F0F", fontWeight: "600", fontSize: 16 },
  footer: { textAlign: "center", marginTop: 32, color: "#333", fontSize: 12 },
});
