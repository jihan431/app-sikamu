import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  StatusBar,
  Modal,
  Linking,
  Image,
  ScrollView,
} from "react-native";
import {
  User,
  LogOut,
  Info,
  ChevronRight,
  Shield,
  Mail,
  MessageCircle,
  X,
  Github,
  Send,
} from "lucide-react-native";
import * as SecureStore from "expo-secure-store";

export default function ProfileScreen({ route, navigation }) {
  const { user } = route.params || {};
  const [aboutVisible, setAboutVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);

  const handleLogout = () => {
    Alert.alert("Logout", "Yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await SecureStore.deleteItemAsync("saved_credentials");
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        },
      },
    ]);
  };

  const openEmail = () => {
    Linking.openURL(
      "mailto:cracked655@gmail.com?subject=SIKAMU%20Mobile%20Support",
    );
  };

  const openWhatsApp = () => {
    Linking.openURL("https://wa.me/6285123248618");
  };

  const openGitHub = () => {
    Linking.openURL("https://github.com/jihan431");
  };

  const openTelegram = () => {
    Linking.openURL("https://t.me/Myflexxd");
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F0F" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          {user?.photoUrl ? (
            <Image
              source={{ uri: user.photoUrl }}
              style={{ width: 100, height: 100, borderRadius: 50 }}
            />
          ) : (
            <User color="#0F0F0F" size={32} />
          )}
        </View>
        <Text style={styles.userName}>{user?.nama || "Mahasiswa"}</Text>
        <Text style={styles.userProdi}>{user?.prodi || "Mahasiswa Aktif"}</Text>
        <Text style={styles.userNpm}>{user?.npm || "-"}</Text>
        {user?.email ? (
          <Text style={styles.userEmail}>{user.email}</Text>
        ) : null}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutIcon} onPress={handleLogout}>
          <LogOut color="#FF4444" size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.ipk || "-"}</Text>
            <Text style={styles.statLabel}>IPK</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.totalSks || "-"}</Text>
            <Text style={styles.statLabel}>SKS</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.sksSisa || "-"}</Text>
            <Text style={styles.statLabel}>Sisa</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setAboutVisible(true)}
          >
            <Info color="#888" size={20} />
            <Text style={styles.menuText}>Tentang Aplikasi</Text>
            <ChevronRight color="#333" size={18} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setPrivacyVisible(true)}
          >
            <Shield color="#888" size={20} />
            <Text style={styles.menuText}>Kebijakan Privasi</Text>
            <ChevronRight color="#333" size={18} />
          </TouchableOpacity>
        </View>

        {/* Contact Developer */}
        <Text style={styles.sectionTitle}>Hubungi Developer</Text>
        <View style={styles.contactGrid}>
          <View style={styles.contactRow}>
            <TouchableOpacity style={styles.contactBtn} onPress={openEmail}>
              <Mail color="#FFF" size={20} />
              <Text style={styles.contactText}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: "#333" }]}
              onPress={openGitHub}
            >
              <Github color="#FFF" size={20} />
              <Text style={styles.contactText}>GitHub</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.contactRow}>
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: "#0088CC" }]}
              onPress={openTelegram}
            >
              <Send color="#FFF" size={20} />
              <Text style={styles.contactText}>Telegram</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: "#25D366" }]}
              onPress={openWhatsApp}
            >
              <MessageCircle color="#FFF" size={20} />
              <Text style={styles.contactText}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Version */}
        <Text style={styles.version}>SIKAMU Mobile v1.0</Text>
      </View>

      {/* About Modal */}
      <Modal visible={aboutVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tentang Aplikasi</Text>
              <TouchableOpacity onPress={() => setAboutVisible(false)}>
                <X color="#888" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalText}>
                <Text style={styles.bold}>SIKAMU Mobile</Text> adalah aplikasi
                mobile untuk mengakses portal akademik SIKAMU.
                {"\n\n"}
                <Text style={styles.bold}>Fitur:</Text>
                {"\n"}• Lihat data akademik (IPK, SKS){"\n"}• Lihat KRS per
                semester{"\n"}• Cetak/download KRS{"\n"}• Pengingat kuliah{"\n"}
                • Auto-login
                {"\n\n"}
                <Text style={styles.bold}>Versi:</Text> 1.0.0{"\n"}
                <Text style={styles.bold}>Developer:</Text> Jihan Nugraha{"\n"}
                <Text style={styles.bold}>Tahun:</Text> 2026
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Privacy Modal */}
      <Modal visible={privacyVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kebijakan Privasi</Text>
              <TouchableOpacity onPress={() => setPrivacyVisible(false)}>
                <X color="#888" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalText}>
                <Text style={styles.bold}>Data yang Kami Kumpulkan</Text>
                {"\n"}Aplikasi ini TIDAK menyimpan data Anda di server
                eksternal. Semua data diambil langsung dari portal SIKAMU resmi
                kampus.
                {"\n\n"}
                <Text style={styles.bold}>Penyimpanan Lokal</Text>
                {"\n"}Jika Anda mengaktifkan "Ingat Saya", kredensial login akan
                disimpan di perangkat Anda secara lokal. Data ini tidak dikirim
                ke pihak ketiga.
                {"\n\n"}
                <Text style={styles.bold}>Keamanan</Text>
                {"\n"}Kami menggunakan koneksi yang sama dengan portal SIKAMU
                untuk menjaga keamanan data Anda.
                {"\n\n"}
                <Text style={styles.bold}>Kontak</Text>
                {"\n"}Untuk pertanyaan privasi, hubungi developer melalui email
                atau WhatsApp.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F0F" },
  header: {
    paddingTop: 56,
    paddingBottom: 2,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  userName: { color: "#FFF", fontSize: 20, fontWeight: "700" },
  userProdi: {
    color: "#4ADE80",
    fontSize: 14,
    marginTop: 4,
    fontWeight: "500",
  },
  userNpm: { color: "#888", fontSize: 13, marginTop: 2 },
  userEmail: { color: "#666", fontSize: 12, marginTop: 2 },
  statusBadge: {
    backgroundColor: "#1A3A1A",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
  },
  statusText: { color: "#4ADE80", fontSize: 12, fontWeight: "500" },
  content: { flex: 1, padding: 24 },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { color: "#FFF", fontSize: 24, fontWeight: "700" },
  statLabel: {
    color: "#666",
    fontSize: 11,
    marginTop: 4,
    textTransform: "uppercase",
  },
  divider: { width: 1, backgroundColor: "#2A2A2A" },
  menuSection: { marginBottom: 24 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  menuText: { color: "#FFF", fontSize: 14, flex: 1, marginLeft: 12 },
  sectionTitle: {
    color: "#666",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  contactGrid: {
    flexDirection: "column",
    gap: 12,
    marginBottom: 24,
  },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "#2A2A2A",
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  contactText: { color: "#FFF", fontSize: 14, fontWeight: "500" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1A1A",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2020",
    gap: 10,
  },
  logoutText: { color: "#FF4444", fontSize: 14, fontWeight: "500" },
  version: { textAlign: "center", color: "#333", fontSize: 12, marginTop: 90 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  modalTitle: { color: "#FFF", fontSize: 18, fontWeight: "600" },
  modalBody: { padding: 20 },
  modalText: { color: "#CCC", fontSize: 14, lineHeight: 22 },
  bold: { fontWeight: "700", color: "#FFF" },
  logoutIcon: {
    position: "absolute",
    top: 60, // Move logout button lower
    right: 24,
    padding: 8,
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
});
