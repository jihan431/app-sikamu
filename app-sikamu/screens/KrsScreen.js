import React, { useState, useCallback, useEffect } from "react";
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
} from "react-native";
import {
  ChevronRight,
  ChevronLeft,
  Download,
  TrendingUp,
  BookOpen,
} from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const API_URL = "http://188.166.234.77:3000";

export default function KrsScreen({ route }) {
  const { user, cookies } = route.params || {};

  const maxSemester = user?.chartData?.semesters?.length || 7;
  const [selectedSemester, setSelectedSemester] = useState(maxSemester);
  const [krsList, setKrsList] = useState([]);
  const [loadingKrs, setLoadingKrs] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Get IP for selected semester from chart data
  const ipSemester = user?.chartData?.ips?.[selectedSemester - 1] || "-";

  useEffect(() => {
    fetchKRS(selectedSemester);
  }, []);

  const fetchKRS = async (semester) => {
    setLoadingKrs(true);
    try {
      const response = await fetch(`${API_URL}/api/krs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, semester }),
      });
      const data = await response.json();
      if (data.success && data.courses) {
        setKrsList(data.courses);
      } else {
        setKrsList([]);
      }
    } catch (error) {
      setKrsList([]);
    } finally {
      setLoadingKrs(false);
    }
  };

  const changeSemester = (direction) => {
    let newSem = selectedSemester + direction;
    if (newSem < 1) newSem = 1;
    if (newSem > maxSemester) newSem = maxSemester;
    setSelectedSemester(newSem);
    fetchKRS(newSem);
  };

  const downloadKRS = async () => {
    setDownloadingPdf(true);
    try {
      const response = await fetch(`${API_URL}/api/krs-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, semester: selectedSemester }),
      });
      const data = await response.json();

      if (data.success && data.pdfBase64) {
        const filename = `KRS_Semester_${selectedSemester}.pdf`;
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, data.pdfBase64, {
          encoding: "base64",
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: "application/pdf" });
        } else {
          Alert.alert("Berhasil", `KRS disimpan: ${filename}`);
        }
      } else {
        Alert.alert("Error", data.message || "Gagal mengunduh KRS");
      }
    } catch (error) {
      Alert.alert("Error", "Gagal mengunduh KRS");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchKRS(selectedSemester);
    setRefreshing(false);
  }, [selectedSemester, cookies]);

  // Calculate stats
  const totalSks = krsList.reduce((sum, c) => sum + (c.sks || 0), 0);
  const courseCount = krsList.length;

  // Grade color
  const getGradeColor = (nilai) => {
    if (!nilai || nilai === "-" || nilai.toLowerCase().includes("belum"))
      return "#666";
    if (nilai === "A" || nilai === "A-") return "#4ADE80";
    if (nilai === "B+" || nilai === "B" || nilai === "B-") return "#60A5FA";
    if (nilai === "C+" || nilai === "C") return "#FBBF24";
    return "#F87171";
  };

  // Format grade - shorten long text
  const formatGrade = (nilai) => {
    if (!nilai) return "-";
    if (nilai.toLowerCase().includes("belum")) return "-";
    return nilai;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F0F" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kartu Rencana Studi</Text>
        <Text style={styles.headerSubtitle}>Nilai & KRS per Semester</Text>
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
        {/* Semester Selector */}
        <View style={styles.semesterSelector}>
          <TouchableOpacity
            onPress={() => changeSemester(-1)}
            disabled={selectedSemester <= 1}
            style={styles.semesterBtn}
          >
            <ChevronLeft
              color={selectedSemester <= 1 ? "#333" : "#FFF"}
              size={24}
            />
          </TouchableOpacity>
          <View style={styles.semesterInfo}>
            <Text style={styles.semesterLabel}>SEMESTER</Text>
            <Text style={styles.semesterValue}>{selectedSemester}</Text>
          </View>
          <TouchableOpacity
            onPress={() => changeSemester(1)}
            disabled={selectedSemester >= maxSemester}
            style={styles.semesterBtn}
          >
            <ChevronRight
              color={selectedSemester >= maxSemester ? "#333" : "#FFF"}
              size={24}
            />
          </TouchableOpacity>
        </View>

        {/* IP & Stats */}
        <View style={styles.statsRow}>
          <View style={styles.ipCard}>
            <TrendingUp color="#4ADE80" size={18} />
            <View style={styles.ipInfo}>
              <Text style={styles.ipLabel}>IP Semester</Text>
              <Text style={styles.ipValue}>{ipSemester}</Text>
            </View>
          </View>
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{courseCount}</Text>
              <Text style={styles.statLabel}>MK</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalSks}</Text>
              <Text style={styles.statLabel}>SKS</Text>
            </View>
          </View>
        </View>

        {/* Download Button */}
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={downloadKRS}
          disabled={downloadingPdf}
        >
          {downloadingPdf ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Download color="#FFF" size={18} />
              <Text style={styles.downloadText}>
                Cetak KRS Semester {selectedSemester}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Course Table */}
        <Text style={styles.sectionTitle}>Daftar Mata Kuliah</Text>

        {loadingKrs ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#FFF" />
            <Text style={styles.loadingText}>Memuat data...</Text>
          </View>
        ) : krsList.length === 0 ? (
          <View style={styles.emptyBox}>
            <BookOpen color="#666" size={32} />
            <Text style={styles.emptyText}>Tidak ada data KRS</Text>
          </View>
        ) : (
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colNo]}>No</Text>
              <Text style={[styles.tableHeaderCell, styles.colNama]}>
                Mata Kuliah
              </Text>
              <Text style={[styles.tableHeaderCell, styles.colSks]}>SKS</Text>
              <Text style={[styles.tableHeaderCell, styles.colNilai]}>
                Nilai
              </Text>
            </View>

            {/* Table Body */}
            {krsList.map((course, index) => (
              <View
                key={index}
                style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}
              >
                <Text style={[styles.tableCell, styles.colNo]}>
                  {index + 1}
                </Text>
                <Text
                  style={[styles.tableCell, styles.colNama]}
                  numberOfLines={2}
                >
                  {course.nama}
                </Text>
                <Text style={[styles.tableCell, styles.colSks]}>
                  {course.sks}
                </Text>
                <View style={[styles.colNilai, { alignItems: "center" }]}>
                  <View
                    style={[
                      styles.gradeBadge,
                      { backgroundColor: getGradeColor(course.nilai) + "20" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.gradeText,
                        { color: getGradeColor(course.nilai) },
                      ]}
                    >
                      {formatGrade(course.nilai)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F0F" },
  header: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 20 },
  headerTitle: { color: "#FFF", fontSize: 22, fontWeight: "700" },
  headerSubtitle: { color: "#666", fontSize: 13, marginTop: 4 },
  content: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 0 },

  semesterSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  semesterBtn: { padding: 4 },
  semesterInfo: { alignItems: "center", paddingHorizontal: 40 },
  semesterLabel: { color: "#666", fontSize: 10, letterSpacing: 1 },
  semesterValue: { color: "#FFF", fontSize: 36, fontWeight: "700" },

  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  ipCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    gap: 12,
  },
  ipInfo: {},
  ipLabel: { color: "#666", fontSize: 10, textTransform: "uppercase" },
  ipValue: { color: "#4ADE80", fontSize: 24, fontWeight: "700" },
  statsCard: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  statItem: { alignItems: "center", paddingHorizontal: 12 },
  statValue: { color: "#FFF", fontSize: 20, fontWeight: "700" },
  statLabel: { color: "#666", fontSize: 10, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#2A2A2A", marginHorizontal: 4 },

  downloadBtn: {
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 24,
  },
  downloadText: { color: "#FFF", fontSize: 14, fontWeight: "600" },

  sectionTitle: {
    color: "#666",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },

  loadingBox: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  loadingText: { color: "#666", marginTop: 12 },
  emptyBox: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  emptyText: { color: "#666", marginTop: 12 },

  // Table styles
  tableContainer: {
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#252525",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  tableHeaderCell: {
    color: "#888",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    alignItems: "center",
  },
  tableRowAlt: { backgroundColor: "#1E1E1E" },
  tableCell: { color: "#FFF", fontSize: 13 },

  // Column widths
  colNo: { width: 30, textAlign: "center" },
  colNama: { flex: 1, paddingHorizontal: 8 },
  colSks: { width: 40, textAlign: "center" },
  colNilai: { width: 50 },

  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 36,
    alignItems: "center",
  },
  gradeText: { fontSize: 12, fontWeight: "700" },
});
