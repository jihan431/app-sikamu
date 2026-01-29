import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import {
  FileText,
  Download,
  ChevronDown,
  Calendar,
  CheckCircle,
} from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";

const API_URL = "http://188.166.234.77:3000";

export default function KpuScreen({ route }) {
  const { cookies } = route.params || {};

  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedOpsi, setSelectedOpsi] = useState(null);
  const [loadingYears, setLoadingYears] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const opsiList = [
    { value: "UTS", label: "UTS (Ujian Tengah Semester)" },
    { value: "UAS", label: "UAS (Ujian Akhir Semester)" },
  ];

  useEffect(() => {
    fetchYears();
  }, []);

  const fetchYears = async () => {
    setLoadingYears(true);
    try {
      const response = await fetch(`${API_URL}/api/kpu-years`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies }),
      });
      const data = await response.json();
      if (data.success && data.years && data.years.length > 0) {
        const filteredYears = data.years.filter((year) => {
          const semester = formatYear(year.code || year.value);
          return semester !== null; // Exclude 'Semester Lama'
        });
        setYears(filteredYears);
        setSelectedYear(filteredYears[filteredYears.length - 1]); // Select latest
      } else {
        // Fallback years if API fails
        const fallbackYears = [
          { value: "20241", label: "20241" },
          { value: "20242", label: "20242" },
          { value: "20251", label: "20251" },
          { value: "20252", label: "20252" },
        ];
        setYears(fallbackYears);
        setSelectedYear(fallbackYears[fallbackYears.length - 1]);
      }
    } catch (error) {
      console.error("Years fetch error:", error);
      // Fallback on error
      const fallbackYears = [
        { value: "20241", label: "20241" },
        { value: "20242", label: "20242" },
        { value: "20251", label: "20251" },
        { value: "20252", label: "20252" },
      ];
      setYears(fallbackYears);
      setSelectedYear(fallbackYears[fallbackYears.length - 1]);
    } finally {
      setLoadingYears(false);
    }
  };

  const downloadKPU = async () => {
    if (!selectedYear || !selectedOpsi) {
      Alert.alert("Pilih Dulu", "Pilih tahun akademik dan jenis ujian.");
      return;
    }

    setDownloading(true);
    try {
      const response = await fetch(`${API_URL}/api/kpu-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookies,
          tahun: selectedYear.code || selectedYear.value, // Use code (20251) not value (0#...)
          opsi: selectedOpsi.value,
        }),
      });
      const data = await response.json();

      if (data.success && data.pdfBase64) {
        const yearCode = selectedYear.code || selectedYear.value;
        const filename = `KPU_${selectedOpsi.value}_${yearCode}.pdf`;
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, data.pdfBase64, {
          encoding: "base64",
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: "application/pdf" });
        } else {
          Alert.alert("Berhasil", `KPU disimpan: ${filename}`);
        }
      } else {
        Alert.alert("Error", data.message || "Gagal mengunduh KPU");
      }
    } catch (error) {
      Alert.alert("Error", "Gagal mengunduh KPU");
    } finally {
      setDownloading(false);
    }
  };

  // Get entry year from NPM (first 2 digits = entry year, e.g., 24 = 2024)
  const npm = route.params?.user?.npm || "";
  const entryYear = npm ? parseInt("20" + npm.substring(0, 2)) : 2024;

  const formatYear = (code) => {
    // Calculate semester number dynamically based on entry year
    // Format: YYYYS where YYYY = year, S = 1 (ganjil) or 2 (genap)
    if (!code || code.length < 5) return code;

    const tahun = parseInt(code.substring(0, 4));
    const isGenap = code.substring(4) === "2";

    // Calculate semester: each year has 2 semesters
    // (tahun - entryYear) * 2 + (1 for ganjil, 2 for genap)
    const semester = (tahun - entryYear) * 2 + (isGenap ? 2 : 1);

    if (semester < 1) return null; // Do not display the option for 'Semester Lama'
    return `Semester ${semester}`;
  };

  const scheduleReminder = async (title, body, date) => {
    try {
      // Schedule the notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: body,
        },
        trigger: { date: new Date(date) },
      });

      // Save the reminder data to AsyncStorage
      const reminders =
        JSON.parse(await SecureStore.getItemAsync("reminders")) || [];
      reminders.push({ id: notificationId, title, body, date });
      await SecureStore.setItemAsync("reminders", JSON.stringify(reminders));

      Alert.alert("Pengingat Disimpan", "Pengingat kuliah berhasil disimpan.");
    } catch (error) {
      console.error("Error scheduling reminder:", error);
      Alert.alert("Error", "Gagal menyimpan pengingat.");
    }
  };

  const loadReminders = async () => {
    try {
      const reminders =
        JSON.parse(await SecureStore.getItemAsync("reminders")) || [];
      reminders.forEach(async (reminder) => {
        const now = new Date();
        const reminderDate = new Date(reminder.date);
        if (reminderDate > now) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: reminder.title,
              body: reminder.body,
            },
            trigger: { date: reminderDate },
          });
        }
      });
    } catch (error) {
      console.error("Error loading reminders:", error);
    }
  };

  // Request permissions for notifications
  useEffect(() => {
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Izin Diperlukan",
          "Aktifkan izin notifikasi untuk pengingat.",
        );
      }
    };
    requestPermissions();
  }, []);

  useEffect(() => {
    loadReminders();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F0F" />

      {/* Header */}
      <View style={styles.header}>
        <FileText color="#FFF" size={28} />
        <Text style={styles.headerTitle}>Kartu Peserta Ujian</Text>
        <Text style={styles.headerSubtitle}>Download KPU untuk UTS/UAS</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        {loadingYears ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#FFF" />
            <Text style={styles.loadingText}>Memuat data...</Text>
          </View>
        ) : (
          <>
            {/* Year Selector */}
            <Text style={styles.sectionTitle}>Tahun Akademik</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowYearPicker(!showYearPicker)}
            >
              <Calendar color="#888" size={18} />
              <Text style={styles.selectorText}>
                {selectedYear
                  ? formatYear(selectedYear.code || selectedYear.value)
                  : "Pilih Tahun"}
              </Text>
              <ChevronDown color="#888" size={18} />
            </TouchableOpacity>

            {showYearPicker && (
              <View style={styles.dropdown}>
                {years.map((y, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.dropdownItem,
                      selectedYear?.code === y.code &&
                        styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      setSelectedYear(y);
                      setShowYearPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        selectedYear?.code === y.code &&
                          styles.dropdownTextActive,
                      ]}
                    >
                      {formatYear(y.code || y.value)}
                    </Text>
                    {selectedYear?.code === y.code && (
                      <CheckCircle color="#4ADE80" size={16} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Opsi Selector */}
            <Text style={styles.sectionTitle}>Jenis Ujian</Text>
            <View style={styles.opsiGrid}>
              {opsiList.map((o, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.opsiCard,
                    selectedOpsi?.value === o.value && styles.opsiCardActive,
                  ]}
                  onPress={() => setSelectedOpsi(o)}
                >
                  <Text
                    style={[
                      styles.opsiValue,
                      selectedOpsi?.value === o.value && styles.opsiValueActive,
                    ]}
                  >
                    {o.value}
                  </Text>
                  <Text style={styles.opsiLabel}>
                    {o.value === "UTS" ? "Tengah Semester" : "Akhir Semester"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Download Button */}
            <TouchableOpacity
              style={[
                styles.downloadBtn,
                (!selectedYear || !selectedOpsi) && styles.downloadBtnDisabled,
              ]}
              onPress={downloadKPU}
              disabled={downloading || !selectedYear || !selectedOpsi}
            >
              {downloading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Download color="#FFF" size={20} />
                  <Text style={styles.downloadText}>Download KPU</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Info */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                KPU (Kartu Peserta Ujian) diperlukan untuk mengikuti UTS dan
                UAS. Pastikan data sudah benar sebelum mencetak.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F0F" },
  header: {
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 12,
  },
  headerSubtitle: { color: "#666", fontSize: 13, marginTop: 4 },
  content: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 0 },

  loadingBox: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  loadingText: { color: "#666", marginTop: 12 },

  sectionTitle: {
    color: "#666",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 12,
    marginTop: 8,
  },

  selector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    gap: 12,
  },
  selectorText: { flex: 1, color: "#FFF", fontSize: 15 },

  dropdown: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  dropdownItemActive: { backgroundColor: "#1A2A1A" },
  dropdownText: { color: "#CCC", fontSize: 14 },
  dropdownTextActive: { color: "#4ADE80", fontWeight: "500" },

  opsiGrid: { flexDirection: "row", gap: 12, marginBottom: 24 },
  opsiCard: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#2A2A2A",
  },
  opsiCardActive: { borderColor: "#4ADE80", backgroundColor: "#1A2A1A" },
  opsiValue: { color: "#FFF", fontSize: 24, fontWeight: "700" },
  opsiValueActive: { color: "#4ADE80" },
  opsiLabel: { color: "#666", fontSize: 11, marginTop: 4 },

  downloadBtn: {
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  downloadBtnDisabled: { opacity: 0.5 },
  downloadText: { color: "#FFF", fontSize: 15, fontWeight: "600" },

  infoBox: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  infoText: {
    color: "#666",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
});
