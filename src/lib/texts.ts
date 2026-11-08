/**
 * Every text guests can see, per UI_LANGUAGE. Used by pages and API routes alike,
 * so this file must not import server code. "en" is the original wording.
 * To add a language: copy `en`, translate it, and add it to TEXTS and to
 * UI_LANGUAGE in src/config.ts.
 */

export const LANGUAGES = ["en", "id"] as const;
export type Language = (typeof LANGUAGES)[number];

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const en = {
  /** Locale for dates and times. undefined = the phone's own setting. */
  locale: undefined as string | undefined,
  metaDescription: "A shared photo album for the day.",
  genericError: "Something went wrong. Please try again.",
  connectError: "Couldn't connect. Please try again.",
  guest: "Guest",
  aGuest: "a guest",

  // Loading and errors
  invalidLinkTitle: "This link isn't valid",
  invalidLinkBody: "Check that you have the whole link, or ask the person who sent it.",
  offlineTitle: "Can't reach the album",
  offlineBody: "We'll keep trying.",
  loading: "Opening the album…",
  connectionLost: "Connection lost. New photos will appear once it's back.",

  // Header status line
  openUntil: (time: string) => `Open until ${time}`,
  opensAt: (time: string) => `Opens at ${time}`,
  closed: "Closed",
  startsAt: (dateTime: string) => `Starts ${dateTime}`,
  ended: "Ended",
  photoCount: (count: number) => plural(count, "photo", "photos"),
  videoCount: (count: number) => plural(count, "video", "videos"),

  // Album states
  albumClosedTitle: "This album has closed",
  albumClosedBody: "The photos have been kept safe, but they're no longer on view.",
  albumNotOpenTitle: "This album hasn't opened yet",
  albumNotOpenBody: (time: string) => `Come back at ${time} to start taking photos.`,
  emptyTitle: "No photos yet",
  emptyOpen: "Be the first. Everyone with this link will see what you take.",
  emptyDayOver: "Nobody took a photo on this day.",
  emptyEventUpcoming: "Photos will appear here once the event starts.",
  emptyEventOver: "No photos were shared at this event.",
  eventNotStartedTitle: "This event hasn't started yet",
  eventNotStartedBody: (dateTime: string) => `You can take photos from ${dateTime}.`,
  eventEndedTitle: "This event has ended",
  eventEndedBody: "Uploads are closed. Thanks for sharing your photos!",

  // Gallery
  viewItem: (kind: "photo" | "video", by: string | null) => `View ${kind}${by ? ` by ${by}` : ""}`,
  photoBy: (by: string) => `Photo by ${by}`,
  videoBy: (by: string) => `Video by ${by}`,
  tileUploading: "Uploading",
  tileFailed: "Failed",
  close: "Close",

  // Footer
  uploadingCount: (count: number) => `Uploading ${count}…`,
  photoCounter: (used: number, limit: number) => `${used} / ${limit} photos`,
  videoCounter: (used: number, limit: number) => ` · ${used} / ${limit} videos`,
  counterToday: " today",
  failedCount: (count: number) => `${count} didn't upload. Check your connection.`,
  retry: "Retry",
  takePhoto: "Take photo",
  addPhoto: "Add photo",
  noPhotosLeft: "No photos left",
  video: "Video",
  noVideosLeft: "No videos",

  // Joining
  yourName: "Your name",
  optional: "(optional)",
  join: "Join",
  joining: "Joining…",

  // Photo camera
  cameraUploading: (count: number) => ` · ${count} uploading`,
  done: "Done",
  flip: "Flip",
  cameraFailed: "The camera didn't open. You can allow it in your browser settings, or use your phone's camera instead.",
  usePhoneCamera: "Use phone camera",
  photoFailed: "That photo didn't work. Please try again.",

  // Video recorder
  videoNeedsHttps: "Video recording needs the secure (https) link and an up-to-date browser.",
  videoUnsupported: "This browser can't record video.",
  videoEmpty: "Nothing was recorded. Please try again.",
  videoStartFailed: "Recording couldn't start. Please try again.",
  videoPermission: "Please allow the camera and microphone in your browser settings, then try again.",
  cancel: "Cancel",
  yourRecording: "Your recording",
  retake: "Retake",
  useVideo: "Use video",
  startRecording: "Start recording",
  stopRecording: "Stop recording",

  // Upload queue
  photoUnreadable: "That photo couldn't be read.",
  uploadRefused: "That upload was refused.",

  // Server replies
  serverError: "Something went wrong on the server. Please try again.",
  dayNotFound: "This Day doesn't exist.",
  dayNotOpenForUploads: "This Day isn't open for uploads.",
  dayNotOpen: "This Day isn't open.",
  joinAgain: "Please join this Day again.",
  nameTooLong: "That name is too long.",
  expectedFile: "Expected a file upload.",
  fileTypeNotAllowed: "That file type isn't allowed.",
  fileTooLarge: (mb: number) => `Uploads can be up to ${mb} MB.`,
  fileUnreadable: "That file couldn't be read. Please try again.",
  photoLimitToday: "You've reached today's photo limit.",
  videoLimitToday: "You've reached today's video limit.",
  photoLimitEvent: "You've used all your photos for this event.",
  videoLimitEvent: "You've used all your videos for this event.",
};

export type Texts = typeof en;

const id: Texts = {
  locale: "id-ID",
  metaDescription: "Album foto bersama.",
  genericError: "Ada yang salah. Silakan coba lagi.",
  connectError: "Tidak bisa terhubung. Silakan coba lagi.",
  guest: "Tamu",
  aGuest: "seorang tamu",

  invalidLinkTitle: "Link ini tidak valid",
  invalidLinkBody: "Pastikan link-nya lengkap, atau tanyakan ke orang yang mengirimnya.",
  offlineTitle: "Album tidak bisa dibuka",
  offlineBody: "Kami akan terus mencoba.",
  loading: "Membuka album…",
  connectionLost: "Koneksi terputus. Foto baru akan muncul setelah koneksi kembali.",

  openUntil: (time) => `Buka sampai ${time}`,
  opensAt: (time) => `Buka pukul ${time}`,
  closed: "Tutup",
  startsAt: (dateTime) => `Mulai ${dateTime}`,
  ended: "Selesai",
  photoCount: (count) => `${count} foto`,
  videoCount: (count) => `${count} video`,

  albumClosedTitle: "Album ini sudah ditutup",
  albumClosedBody: "Foto-fotonya tetap tersimpan aman, tapi sudah tidak ditampilkan.",
  albumNotOpenTitle: "Album ini belum dibuka",
  albumNotOpenBody: (time) => `Kembali lagi pukul ${time} untuk mulai mengambil foto.`,
  emptyTitle: "Belum ada foto",
  emptyOpen: "Jadilah yang pertama. Semua yang punya link ini akan melihat fotomu.",
  emptyDayOver: "Tidak ada yang mengambil foto hari itu.",
  emptyEventUpcoming: "Foto akan muncul di sini setelah acara dimulai.",
  emptyEventOver: "Tidak ada foto yang dibagikan di acara ini.",
  eventNotStartedTitle: "Acara belum dimulai",
  eventNotStartedBody: (dateTime) => `Kamu bisa mulai mengambil foto ${dateTime}.`,
  eventEndedTitle: "Acara sudah selesai",
  eventEndedBody: "Upload sudah ditutup. Terima kasih sudah berbagi foto!",

  viewItem: (kind, by) => `Lihat ${kind === "video" ? "video" : "foto"}${by ? ` dari ${by}` : ""}`,
  photoBy: (by) => `Foto dari ${by}`,
  videoBy: (by) => `Video dari ${by}`,
  tileUploading: "Mengupload",
  tileFailed: "Gagal",
  close: "Tutup",

  uploadingCount: (count) => `Mengupload ${count}…`,
  photoCounter: (used, limit) => `${used} / ${limit} foto`,
  videoCounter: (used, limit) => ` · ${used} / ${limit} video`,
  counterToday: " hari ini",
  failedCount: (count) => `${count} gagal diupload. Cek koneksimu.`,
  retry: "Coba lagi",
  takePhoto: "Ambil foto",
  addPhoto: "Tambah foto",
  noPhotosLeft: "Jatah foto habis",
  video: "Video",
  noVideosLeft: "Video habis",

  yourName: "Namamu",
  optional: "(opsional)",
  join: "Gabung",
  joining: "Bergabung…",

  cameraUploading: (count) => ` · ${count} sedang diupload`,
  done: "Selesai",
  flip: "Balik",
  cameraFailed: "Kamera tidak bisa dibuka. Izinkan kamera di pengaturan browser, atau pakai kamera bawaan HP.",
  usePhoneCamera: "Pakai kamera HP",
  photoFailed: "Foto tadi gagal. Silakan coba lagi.",

  videoNeedsHttps: "Rekam video butuh link aman (https) dan browser versi terbaru.",
  videoUnsupported: "Browser ini tidak bisa merekam video.",
  videoEmpty: "Tidak ada yang terekam. Silakan coba lagi.",
  videoStartFailed: "Rekaman tidak bisa dimulai. Silakan coba lagi.",
  videoPermission: "Izinkan kamera dan mikrofon di pengaturan browser, lalu coba lagi.",
  cancel: "Batal",
  yourRecording: "Rekamanmu",
  retake: "Ulangi",
  useVideo: "Pakai video",
  startRecording: "Mulai rekam",
  stopRecording: "Berhenti rekam",

  photoUnreadable: "Foto itu tidak bisa dibaca.",
  uploadRefused: "Upload itu ditolak.",

  serverError: "Ada masalah di server. Silakan coba lagi.",
  dayNotFound: "Album ini tidak ada.",
  dayNotOpenForUploads: "Album ini sedang tidak menerima upload.",
  dayNotOpen: "Album ini sedang tidak dibuka.",
  joinAgain: "Silakan gabung lagi.",
  nameTooLong: "Nama itu terlalu panjang.",
  expectedFile: "File tidak terkirim. Silakan coba lagi.",
  fileTypeNotAllowed: "Jenis file itu tidak diizinkan.",
  fileTooLarge: (mb) => `Ukuran upload maksimal ${mb} MB.`,
  fileUnreadable: "File itu tidak bisa dibaca. Silakan coba lagi.",
  photoLimitToday: "Jatah foto hari ini sudah habis.",
  videoLimitToday: "Jatah video hari ini sudah habis.",
  photoLimitEvent: "Jatah foto untuk acara ini sudah habis.",
  videoLimitEvent: "Jatah video untuk acara ini sudah habis.",
};

const TEXTS: Record<Language, Texts> = { en, id };

export interface TextOverrides {
  eventNotStartedText: string | null;
  eventEndedText: string | null;
}

/** The catalog for a language, with the event messages set in env (if any) on top. */
export function getTexts(language: Language, overrides?: TextOverrides): Texts {
  const base = TEXTS[language];
  if (!overrides) return base;
  return {
    ...base,
    eventNotStartedBody: overrides.eventNotStartedText ? () => overrides.eventNotStartedText! : base.eventNotStartedBody,
    eventEndedBody: overrides.eventEndedText ?? base.eventEndedBody,
  };
}
