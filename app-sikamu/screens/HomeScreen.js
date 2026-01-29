import React, { useState, useCallback, useEffect } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Switch,
  Platform,
} from "react-native";
import {
  BookOpen,
  CreditCard,
  TrendingUp,
  Bell,
  BellOff,
  Calendar,
  GraduationCap,
} from "lucide-react-native";

const API_URL = "http://188.166.234.77:3000";

let Notifications = null;
try {
  Notifications = require("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (e) {}

export default function HomeScreen({ route }) {
  const { user, cookies, redirectUrl } = route.params || {};

  const [userData, setUserData] = useState(user || {});
  
  // Debug log
  useEffect(() => {
    console.log("HomeScreen user data:", user);
  }, [user]);
  const [refreshing, setRefreshing] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [notificationsAvailable, setNotificationsAvailable] = useState(false);

  const currentSemester = userData?.chartData?.semesters?.length || 1;

  // Load reminder settings from AsyncStorage on mount
  useEffect(() => {
    loadReminderSettings();
    checkNotificationSupport();
    createNotificationChannel();
  }, []);

  const loadReminderSettings = async () => {
    try {
      const savedSettings = await SecureStore.getItemAsync("reminderSettings");
      if (savedSettings) {
        const { enabled, time } = JSON.parse(savedSettings);
        setReminderEnabled(enabled);
        if (time) {
          const date = new Date();
          const [hours, minutes] = time.split(":");
          date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          setReminderTime(date);
          // Reschedule if was enabled
          if (enabled) {
            setTimeout(() => scheduleReminder(date), 500);
          }
        }
      }
    } catch (error) {
      console.error("Error loading reminder settings:", error);
    }
  };

  const saveReminderSettings = async (enabled, time) => {
    try {
      await SecureStore.setItemAsync(
        "reminderSettings",
        JSON.stringify({
          enabled,
          time: `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`,
        }),
      );
    } catch (error) {
      console.error("Error saving reminder settings:", error);
    }
  };

  const createNotificationChannel = async () => {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
  };

  const checkNotificationSupport = async () => {
    if (!Notifications) return;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationsAvailable(status === "granted");
    } catch (e) {}
  };

  const fetchDashboard = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dashboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, redirectUrl }),
      });
      const data = await response.json();
      if (data.success) setUserData(data);
    } catch (error) {}
  };

  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Initialize default time to 19:00
  useEffect(() => {
    const defaultTime = new Date();
    defaultTime.setHours(19, 0, 0, 0);
    setReminderTime(defaultTime);
  }, []);

  const onTimeChange = (event, selectedDate) => {
    setShowTimePicker(false);
    if (selectedDate) {
      setReminderTime(selectedDate);
      saveReminderSettings(reminderEnabled, selectedDate);
      if (reminderEnabled) {
        // Reschedule if already enabled
        scheduleReminder(selectedDate);
      }
    }
  };

  const scheduleReminder = async (date) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "📚 Pengingat Kuliah",
        body: "Siapkan materi untuk besok!",
        sound: true,
      },
      trigger: {
        hour: date.getHours(),
        minute: date.getMinutes(),
        repeats: true,
      },
    });
  };

  const toggleReminder = async (value) => {
    if (!Notifications || !notificationsAvailable) {
      Alert.alert("Tidak Tersedia", "Notifikasi tidak didukung di Expo Go.");
      return;
    }
    setReminderEnabled(value);
    saveReminderSettings(value, reminderTime);
    if (value) {
      await scheduleReminder(reminderTime);
      Alert.alert(
        "Aktif",
        `Pengingat jam ${reminderTime.getHours()}:${reminderTime.getMinutes().toString().padStart(2, "0")} diaktifkan.`,
      );
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  }, [cookies, redirectUrl]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F0F" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Selamat Datang,</Text>
        <Text style={styles.userName}>{userData?.nama || "Mahasiswa"}</Text>
        <View style={styles.npmRow}>
          <Text style={styles.userNim}>{userData?.npm || ""}</Text>
          <View style={styles.semesterBadgeHeader}>
            <Calendar color="#888" size={12} />
            <Text style={styles.semesterTextHeader}>Semester {currentSemester}</Text>
          </View>
          <View
            style={[
              styles.statusBadgeHeader,
              {
                backgroundColor:
                  userData?.status === "Aktif" || userData?.status === "Teregistrasi Aktif" ? "#1A3A1A" : "#3A2A1A",
              },
            ]}
          >
            <View
              style={[
                styles.statusDotHeader,
                {
                  backgroundColor:
                    userData?.status === "Aktif" || userData?.status === "Teregistrasi Aktif" ? "#4ADE80" : "#F59E0B",
                },
              ]}
            />
            <Text style={styles.statusTextHeader}>
              {userData?.status || "Aktif"}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFF"
            colors={["#FFF"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Main Stats */}
        <View style={styles.mainStatsGrid}>
          <View style={styles.mainStatCard}>
            <View style={styles.statIconContainer}>
              <TrendingUp color="#FFF" size={20} />
            </View>
            <Text style={styles.mainStatValue}>{userData?.ipk || "-"}</Text>
            <Text style={styles.mainStatLabel}>IP Kumulatif</Text>
          </View>
          <View style={styles.mainStatCard}>
            <View style={styles.statIconContainer}>
              <GraduationCap color="#FFF" size={20} />
            </View>
            <Text style={styles.mainStatValue}>
              {userData?.chartData?.ips?.[currentSemester - 1] || "-"}
            </Text>
            <Text style={styles.mainStatLabel}>IP Semester</Text>
          </View>
        </View>

        {/* SKS Progress */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Progress SKS</Text>
          
          {/* Stats */}
          <View style={styles.progressRow}>
            <View style={styles.progressItem}>
              <Text style={styles.progressValue}>
                {userData?.sksDitempuh || "-"}
              </Text>
              <Text style={styles.progressLabel}>Ditempuh</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressItem}>
              <Text style={styles.progressValue}>
                {userData?.sksSisa || "-"}
              </Text>
              <Text style={styles.progressLabel}>Sisa</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressItem}>
              <Text style={styles.progressValue}>
                {userData?.totalSks || "-"}
              </Text>
              <Text style={styles.progressLabel}>Total</Text>
            </View>
          </View>
          
          {/* Progress Bar */}
          <View style={[styles.progressBarContainer, { marginTop: 16 }]}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${((userData?.sksDitempuh || 0) / (userData?.totalSks || 1)) * 100}%`,
                },
              ]}
            />
          </View>
        </View>

        {/* Tagihan */}
        <View style={styles.tagihanCard}>
          <View style={styles.tagihanIcon}>
            <CreditCard color="#FFF" size={18} />
          </View>
          <View style={styles.tagihanInfo}>
            <Text style={styles.tagihanLabel}>Tagihan Semester</Text>
            <Text style={styles.tagihanValue}>
              {userData?.tagihan || "Rp 0"}
            </Text>
          </View>
        </View>

        {/* Reminder */}
        <View style={styles.reminderCard}>
          {reminderEnabled ? (
            <Bell color="#FFF" size={18} />
          ) : (
            <BellOff color="#666" size={18} />
          )}
          <TouchableOpacity
            style={styles.reminderInfo}
            onPress={() => setShowTimePicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.reminderTitle}>Pengingat Kuliah</Text>
            <Text style={styles.reminderDesc}>
              {reminderEnabled
                ? `Jam ${reminderTime.getHours().toString().padStart(2, "0")}:${reminderTime.getMinutes().toString().padStart(2, "0")}`
                : "Klik untuk atur jam"}
            </Text>
          </TouchableOpacity>
          <Switch
            value={reminderEnabled}
            onValueChange={toggleReminder}
            trackColor={{ false: "#2A2A2A", true: "#444" }}
            thumbColor={reminderEnabled ? "#FFF" : "#666"}
          />
        </View>

        {showTimePicker && (
          <DateTimePicker
            value={reminderTime}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            is24Hour={true}
            onChange={onTimeChange}
          />
        )}


      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F0F" },
  header: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 20 },
  greeting: { color: "#666", fontSize: 14 },
  userName: { color: "#FFF", fontSize: 24, fontWeight: "700", marginTop: 4 },
  userNim: { color: "#666", fontSize: 13, marginTop: 2 },
  npmRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 },
  semesterBadgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  semesterTextHeader: { color: "#888", fontSize: 11, fontWeight: "500" },
  statusBadgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  statusDotHeader: { width: 6, height: 6, borderRadius: 3 },
  statusTextHeader: { color: "#FFF", fontSize: 11, fontWeight: "500" },
  content: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 0 },

  semesterBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    gap: 6,
  },
  semesterText: { color: "#888", fontSize: 12, fontWeight: "500" },

  mainStatsGrid: { flexDirection: "row", gap: 12, marginBottom: 12 },
  mainStatCard: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  mainStatValue: { color: "#FFF", fontSize: 32, fontWeight: "700" },
  mainStatLabel: {
    color: "#666",
    fontSize: 11,
    marginTop: 4,
    textTransform: "uppercase",
  },

  progressCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  progressTitle: {
    color: "#666",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  progressRow: { flexDirection: "row", alignItems: "center" },
  progressItem: { flex: 1, alignItems: "center" },
  progressValue: { color: "#FFF", fontSize: 24, fontWeight: "700" },
  progressLabel: { color: "#666", fontSize: 11, marginTop: 4 },
  progressDivider: { width: 1, height: 40, backgroundColor: "#2A2A2A" },
  
  // Progress Bar
  progressBarContainer: {
    height: 8,
    backgroundColor: "#1A3A1A",
    borderRadius: 4,
    marginBottom: 6,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#4ADE80",
    borderRadius: 4,
  },
  progressText: {
    color: "#666",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 4,
  },

  tagihanCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  tagihanIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
  },
  tagihanInfo: { marginLeft: 14 },
  tagihanLabel: { color: "#666", fontSize: 11, textTransform: "uppercase" },
  tagihanValue: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 2,
  },

  reminderCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  reminderInfo: { flex: 1, marginLeft: 14 },
  reminderTitle: { color: "#FFF", fontSize: 14, fontWeight: "500" },
  reminderDesc: { color: "#666", fontSize: 12, marginTop: 2 },

  statusCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: "#888", fontSize: 13, marginLeft: 10 },
});
