import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, ArrowRight, UploadCloud, X, CheckCircle2, Camera, Image as ImageIcon, Video } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { uploadToSupabase } from '../../services/storage';
import { updateUserProfile } from '../../services/auth';

export default function DocumentUploadScreen() {
  const { user, profile, setProfile } = useAuthStore();
  const [files, setFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [videoFile, setVideoFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [loading, setLoading] = useState(false);

  const isGuide = profile?.role === 'guide';

  const handlePickDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Allow images, PDFs, etc.
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        // Append new files without duplicates by uri
        const newFiles = [...files];
        result.assets.forEach(asset => {
          if (!newFiles.find(f => f.uri === asset.uri)) {
            newFiles.push(asset);
          }
        });
        setFiles(newFiles);
      }
    } catch (error) {
      console.error('Error picking document', error);
      Alert.alert('Error', 'Failed to pick documents.');
    }
  };

  const handlePickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const durationMs = asset.duration;
      // Duration check: 30s (30000ms) to 60s (60000ms)
      if (durationMs && (durationMs < 29000 || durationMs > 61000)) {
        Alert.alert('Invalid Video', 'Demo Video must be between 30 seconds and 1 minute.');
        return;
      }
      setVideoFile({
        uri: asset.uri,
        name: asset.fileName || `video_${Date.now()}.mp4`,
        mimeType: asset.mimeType || 'video/mp4',
        size: asset.fileSize,
      } as DocumentPicker.DocumentPickerAsset);
    }
  };

  const handleRecordVideo = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow camera access to record a video.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      videoMaxDuration: 60,
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const durationMs = asset.duration;
      // Duration check: 30s (30000ms) to 60s (60000ms)
      if (durationMs && (durationMs < 29000 || durationMs > 61000)) {
        Alert.alert('Invalid Video', 'Demo Video must be between 30 seconds and 1 minute.');
        return;
      }
      setVideoFile({
        uri: asset.uri,
        name: asset.fileName || `video_${Date.now()}.mp4`,
        mimeType: asset.mimeType || 'video/mp4',
        size: asset.fileSize,
      } as DocumentPicker.DocumentPickerAsset);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const newFiles = [...files];
      if (!newFiles.find(f => f.uri === asset.uri)) {
        newFiles.push({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        } as DocumentPicker.DocumentPickerAsset);
      }
      setFiles(newFiles);
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow camera access to take a photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const newFiles = [...files];
      if (!newFiles.find(f => f.uri === asset.uri)) {
        newFiles.push({
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        } as DocumentPicker.DocumentPickerAsset);
      }
      setFiles(newFiles);
    }
  };

  const removeFile = (uri: string) => {
    setFiles(files.filter(f => f.uri !== uri));
  };

  const removeVideo = () => {
    setVideoFile(null);
  };

  const handleSkip = async () => {
    if (!user) return;

    await updateUserProfile(user.uid, {
      isOnboarded: true,
    });
    setProfile({
      ...profile!,
      isOnboarded: true,
    });

    router.replace('/(tabs)/dashboard');
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      Alert.alert('No files selected', 'Please select at least one document to upload or tap Skip for now.');
      return;
    }

    if (isGuide && !videoFile) {
      Alert.alert('Missing Demo Video', 'As a guide, you must upload a 30 to 60 second Demo Video.');
      return;
    }

    if (!user) return;
    setLoading(true);

    try {
      const uploadedUrls: string[] = [];

      // Upload each file
      for (const file of files) {
        const fileName = `${Date.now()}_${file.name}`;
        const mimeType = file.mimeType || 'application/octet-stream';

        // upload local file to Supabase
        const downloadUrl = await uploadToSupabase(file.uri, mimeType, fileName, 'documents');
        uploadedUrls.push(downloadUrl);
      }

      let kycVideoUrl = profile?.kycVideoUrl;
      if (videoFile) {
        const fileName = `${Date.now()}_${videoFile.name}`;
        const mimeType = videoFile.mimeType || 'video/mp4';
        kycVideoUrl = await uploadToSupabase(videoFile.uri, mimeType, fileName, 'documents');
      }

      // Update firestore profile
      const newDocs = [...(profile?.documents || []), ...uploadedUrls];
      await updateUserProfile(user.uid, {
        hasUploadedDocs: true,
        documents: newDocs,
        ...(kycVideoUrl && { kycVideoUrl }),
        isOnboarded: true,
      });

      // Update local store
      setProfile({
        ...profile!,
        hasUploadedDocs: true,
        documents: newDocs,
        ...(kycVideoUrl && { kycVideoUrl }),
        isOnboarded: true,
      });

      router.replace('/(tabs)/dashboard');
    } catch (err) {
      console.error('Error uploading docs', err);
      Alert.alert('Upload Failed', 'There was an issue uploading your documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.branding}>
          <FileText color={Colors.primary} size={24} />
          <Text style={styles.brandText}>Verification</Text>
        </View>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>Step 4 of 4</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Upload{'\n'}Documents</Text>
        <Text style={styles.subheading}>
          To verify your account, please upload related business licenses or an Identity Proof.
          You can do this later, but creating listings requires verified documents.
        </Text>

        <View style={styles.uploadOptions}>
          <TouchableOpacity style={styles.uploadBox} onPress={handlePickDocuments} activeOpacity={0.8}>
            <UploadCloud color={Colors.primary} size={32} style={{ marginBottom: 8 }} />
            <Text style={styles.uploadText}>Files</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadBox} onPress={handlePickImage} activeOpacity={0.8}>
            <ImageIcon color={Colors.primary} size={32} style={{ marginBottom: 8 }} />
            <Text style={styles.uploadText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadBox} onPress={handleTakePhoto} activeOpacity={0.8}>
            <Camera color={Colors.primary} size={32} style={{ marginBottom: 8 }} />
            <Text style={styles.uploadText}>Camera</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.uploadSubhint, { textAlign: 'center', marginBottom: Spacing.lg }]}>
          Supported formats: PDF, JPEG, PNG
        </Text>

        {files.length > 0 && (
          <View style={styles.fileList}>
            {files.map((file, index) => (
              <View key={index} style={styles.fileRow}>
                <View style={styles.fileInfo}>
                  <FileText color={Colors.textMuted} size={20} />
                  <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                    {file.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeFile(file.uri)} style={styles.removeBtn}>
                  <X color={Colors.textLight} size={18} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {isGuide && (
          <>
            <Text style={[styles.subheading, { marginBottom: Spacing.sm, marginTop: Spacing.sm, fontWeight: '700', color: Colors.text }]}>
              Demo Video (Mandatory for Guides)
            </Text>
            <Text style={[styles.uploadSubhint, { marginBottom: Spacing.md }]}>
              Please record or upload a 30 to 60 second video introducing yourself.
            </Text>

            <View style={styles.uploadOptions}>
              <TouchableOpacity style={styles.uploadBox} onPress={handlePickVideo} activeOpacity={0.8}>
                <Video color={Colors.primary} size={32} style={{ marginBottom: 8 }} />
                <Text style={styles.uploadText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadBox} onPress={handleRecordVideo} activeOpacity={0.8}>
                <Camera color={Colors.primary} size={32} style={{ marginBottom: 8 }} />
                <Text style={styles.uploadText}>Record</Text>
              </TouchableOpacity>
            </View>

            {videoFile && (
              <View style={[styles.fileRow, { marginBottom: Spacing.xl }]}>
                <View style={styles.fileInfo}>
                  <Video color={Colors.textMuted} size={20} />
                  <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                    {videoFile.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={removeVideo} style={styles.removeBtn}>
                  <X color={Colors.textLight} size={18} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.submitBtn, files.length === 0 && styles.submitBtnDisabled, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading || files.length === 0}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <CheckCircle2 color={Colors.white} size={20} />
                <Text style={styles.submitBtnText}>Submit Documents</Text>
              </>
            )}
          </TouchableOpacity>

          {!loading && (
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip for now</Text>
              <ArrowRight color={Colors.textMuted} size={16} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.primary,
  },
  stepBadge: {
    backgroundColor: Colors.inputBg,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: 60,
  },
  heading: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 40,
    marginBottom: Spacing.sm,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  uploadOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  uploadBox: {
    flex: 1,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inputBg,
  },
  uploadText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
  uploadSubhint: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  fileList: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  fileName: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '500',
    flexShrink: 1,
  },
  removeBtn: {
    padding: 4,
  },
  actions: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  skipText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
