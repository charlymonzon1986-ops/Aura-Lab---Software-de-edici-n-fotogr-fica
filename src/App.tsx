import * as React from "react";
import EXIF from "exif-js";
import { motion, AnimatePresence } from "motion/react";
import { 
  X,
  LayoutGrid, 
  Settings2, 
  User as UserIcon, 
  ShieldCheck, 
  HardDrive, 
  Zap,
  Layout,
  Plus,
  HardDrive as HardDriveIcon,
  Image as ImageIcon, 
  Sun, 
  Maximize2, 
  ZoomIn,
  ZoomOut,
  Sparkles, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight,
  Download,
  Info,
  Upload,
  Eye,
  Split,
  MousePointer2,
  LogOut,
  Crown,
  Save,
  Trash2,
  Lock,
  CreditCard,
  CheckCircle2,
  Trash2 as TrashIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import axios from "axios";
import { LightingControls } from "@/src/components/LightingControls";
import { ImageCanvas } from "@/src/components/ImageCanvas";
import { Histogram } from "@/src/components/Histogram";
import { Photo, DEFAULT_SETTINGS, LightingSettings } from "@/src/types";
import { getFilterString, renderProcessedToCanvas } from "@/src/lib/imageProcessing";
import { auth, db, storage, signInWithGoogle, logout } from "@/src/firebase";
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { 
  collection, 
  query, 
  where, 
  or,
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp,
  orderBy,
  limit
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { Progress } from "@/components/ui/progress";
import { SYSTEM_PRESETS } from "@/src/constants/presets";
import { UserProfile, PlanType, STORAGE_LIMITS, Preset, PLAN_PRICES } from "@/src/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperationType, handleFirestoreError } from "@/src/firebase";

const fixImageUrl = (url: string) => {
  if (!url) return "";
  
  // Google Drive Fix
  const driveMatch = url.match(/\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  }
  
  // Dropbox Fix
  if (url.includes("dropbox.com") && url.endsWith("dl=0")) {
    return url.replace("dl=0", "raw=1");
  }

  return url;
};

export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [userPresets, setUserPresets] = React.useState<Preset[]>([]);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [customLogo, setCustomLogo] = React.useState<string | null>(null);
  const [showPricing, setShowPricing] = React.useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = React.useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = React.useState<string | null>(null);
  
  // Reset zoom when photo changes
  React.useEffect(() => {
    resetZoom();
  }, [selectedPhotoId]);
  const [isAutoEnhancing, setIsAutoEnhancing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = React.useState<'gallery' | 'editor'>('gallery');
  const [showControls, setShowControls] = React.useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isComparing, setIsComparing] = React.useState(false);
  const [compareValue, setCompareValue] = React.useState(50);
  const [isPressing, setIsPressing] = React.useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Payment Status Listener
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const paymentId = params.get("payment_id");

    if (status === "approved" && paymentId) {
      toast.success("¡Pago exitoso! Tu plan ha sido actualizado.", {
        description: "Puede tardar unos segundos en reflejarse en tu perfil.",
        duration: 5000
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (status === "failure" || status === "rejected") {
      toast.error("El pago no pudo ser procesado.", {
        description: "Por favor, intenta nuevamente o contacta a soporte."
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Login error details:", error);
      const errorMessage = error.code === 'auth/unauthorized-domain' 
        ? "Este dominio no está autorizado en Firebase. Por favor, añade este dominio a la lista de dominios autorizados en la consola de Firebase."
        : (error.message || "Error al iniciar sesión");
      
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-bold">Error de Autenticación</span>
          <span className="text-xs opacity-80">{errorMessage}</span>
          {error.code && <span className="text-[10px] font-mono bg-red-500/20 px-1 rounded w-fit">Código: {error.code}</span>}
        </div>
      );
    }
  };

  // Auth Listener
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Check/Create User Profile
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          const adminEmails = ["juanomonzon@gmail.com", "charlymonzon.1986@gmail.com", "socia@example.com", "ruth1094@gmail.com"];
          const isAdmin = adminEmails.includes(currentUser.email?.toLowerCase() || "");
          
          if (!userDoc.exists()) {
            const profile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || "",
              displayName: currentUser.displayName || "Usuario",
              role: isAdmin ? "admin" : "user",
              plan: isAdmin ? "studio" : "free",
              storageUsed: 0,
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, profile);
            setUserProfile(profile);
          } else {
            const data = userDoc.data() as UserProfile;
            // Force admin status for test emails
            if (isAdmin && (data.role !== 'admin' || data.plan !== 'studio')) {
              const updatedProfile = { ...data, role: 'admin' as const, plan: 'studio' as const };
              await updateDoc(userDocRef, { role: 'admin', plan: 'studio' });
              setUserProfile(updatedProfile);
            } else {
              setUserProfile(data);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, "users/" + currentUser.uid);
        }
      } else {
        setUserProfile(null);
        setPhotos([]); // No more samples
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Photos Listener
  React.useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "photos"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPhotos = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Photo[];
      setPhotos(fetchedPhotos);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "photos");
      toast.error("Error al cargar tus fotos");
    });

    return () => unsubscribe();
  }, [user]);

  // Presets Listener
  React.useEffect(() => {
    if (!user) {
      setUserPresets([]);
      return;
    }

    // Fetch both system presets and user presets
    // If user is admin, they can see all. If not, they need the filter.
    const isAdmin = userProfile?.role === 'admin';
    
    let q;
    if (isAdmin) {
      q = query(
        collection(db, "presets"),
        orderBy("createdAt", "desc")
      );
    } else {
      q = query(
        collection(db, "presets"),
        or(
          where("userId", "==", user.uid),
          where("isSystem", "==", true)
        ),
        orderBy("createdAt", "desc")
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allPresets = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Preset[];
      
      const system = allPresets.filter(p => p.isSystem);
      const userP = allPresets.filter(p => p.userId === user?.uid && !p.isSystem);
      
      setUserPresets(userP);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "presets");
    });

    return () => unsubscribe();
  }, [user, userProfile]);

  const addPhoto = async (url: string, title: string = "Nueva Foto", size: number = 0, storagePath?: string, thumbnailUrl?: string) => {
    if (!user || !userProfile) {
      toast.error("Debes iniciar sesión para guardar fotos");
      return;
    }

    // Check storage limits
    const currentLimit = STORAGE_LIMITS[userProfile.plan];
    if (userProfile.storageUsed + size > currentLimit) {
      toast.error("Has alcanzado el límite de almacenamiento de tu plan", {
        action: {
          label: "Mejorar Plan",
          onClick: () => setShowPricing(true)
        }
      });
      return;
    }

    const photoData = {
      userId: user.uid,
      url: url,
      thumbnailUrl: thumbnailUrl || null,
      title: title,
      description: "Imagen añadida por el usuario.",
      settings: { ...DEFAULT_SETTINGS },
      createdAt: serverTimestamp(),
      isPublic: false,
      size: size,
      storagePath: storagePath || null
    };

    console.log("Intentando guardar en Firestore con datos:", {
      ...photoData,
      url: url.startsWith('data:') ? `DataURL(${url.length} chars)` : url
    });

    try {
      const docRef = await addDoc(collection(db, "photos"), photoData);

      console.log("Foto guardada en Firestore con ID:", docRef.id);

      // Update user storage usage
      try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          storageUsed: (userProfile.storageUsed || 0) + size
        });
      } catch (userUpdateErr) {
        console.warn("Error al actualizar espacio usado (no crítico):", userUpdateErr);
      }

      toast.success("Foto guardada en tu galería privada");
    } catch (error: any) {
      console.error("Error detallado al guardar en Firestore:", error);
      
      if (error.message?.includes("exceeds the maximum allowed size")) {
        toast.error("La imagen es demasiado grande para el modo de emergencia. Por favor, intenta con una imagen más pequeña (< 700KB) mientras se activa el almacenamiento en la nube.");
      } else {
        handleFirestoreError(error, OperationType.CREATE, "photos");
        toast.error("Error al guardar la información de la foto");
      }
    }
  };

  const handleUrlAdd = () => {
    if (!newPhotoUrl) return;
    try {
      const fixedUrl = fixImageUrl(newPhotoUrl);
      addPhoto(fixedUrl, "Foto desde URL", 0);
      setNewPhotoUrl("");
    } catch (error) {
      toast.error("Error al procesar la URL");
    }
  };

  const [uploadProgress, setUploadProgress] = React.useState<number>(0);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) {
      console.log("Upload aborted: No file or user not logged in", { file: !!file, user: !!user });
      return;
    }

    console.log("Starting upload for file:", {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified).toISOString()
    });

    const isRaw = /\.(arw|cr2|nef|dng|orf|raf)$/i.test(file.name);
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(file.name);

    if (!isRaw && !isImage) {
      toast.error("Formato de archivo no soportado. Usa JPG, PNG o formatos RAW (ARW, CR2, etc.)");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Sanitize filename: remove special characters and spaces
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const storagePath = `users/${user.uid}/photos/${Date.now()}_${sanitizedName}`;
    const storageRef = ref(storage, storagePath);
    
    console.log("Storage Reference created:", storageRef.fullPath);
    console.log("Bucket:", storageRef.bucket);

    try {
      console.log("Iniciando subida vía servidor (Almacenamiento Local)...");
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.uid);
      formData.append("path", storagePath);

      const response = await axios.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / (progressEvent.total || file.size));
          setUploadProgress(progress);
        }
      });

      const { url } = response.data;
      console.log("Subida exitosa. URL recibida:", url);

      await addPhoto(url, file.name, file.size, storagePath);
      
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Archivo subido correctamente");
    } catch (error: any) {
      console.error("Error en la subida:", error);
      setIsUploading(false);
      setUploadProgress(0);
      
      const errorMsg = error.response?.data?.error || error.message;
      toast.error(`Error al subir el archivo: ${errorMsg}`);
    }
  };

  const selectedPhoto = React.useMemo(() => 
    photos.find(p => p.id === selectedPhotoId),
    [photos, selectedPhotoId]
  );

  const updatePhotoSettings = React.useCallback((id: string, settings: LightingSettings) => {
    // Update local state for immediate feedback
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, settings } : p));
  }, []);

  // Debounced Firestore sync
  React.useEffect(() => {
    if (!selectedPhotoId || !user) return;
    
    const photo = photos.find(p => p.id === selectedPhotoId);
    if (!photo || photo.id.length < 10) return; // Skip samples

    const timer = setTimeout(async () => {
      try {
        await updateDoc(doc(db, "photos", photo.id), { settings: photo.settings });
      } catch (error) {
        console.error("Error syncing settings:", error);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [photos, selectedPhotoId, user]);

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Performance optimization: Update CSS variables for filters
  React.useEffect(() => {
    if (!selectedPhoto) return;
    const s = selectedPhoto.settings;
    const root = document.documentElement;
    root.style.setProperty('--img-brightness', `${s.brightness}%`);
    root.style.setProperty('--img-contrast', `${s.contrast}%`);
    root.style.setProperty('--img-saturate', `${s.saturation}%`);
    root.style.setProperty('--img-sepia', `${s.warmth > 0 ? s.warmth : 0}%`);
    root.style.setProperty('--img-hue', `${s.tint}deg`);
    root.style.setProperty('--img-exposure', `${1 + s.exposure / 100}`);
    root.style.setProperty('--img-vignette', `${s.vignette / 100}`);
  }, [selectedPhoto?.settings]);
  const deletePhoto = async (id: string) => {
    if (!user || !userProfile) return;
    try {
      const photoToDelete = photos.find(p => p.id === id);
      const photoSize = (photoToDelete as any)?.size || 0;
      const storagePath = (photoToDelete as any)?.storagePath;

      await deleteDoc(doc(db, "photos", id));
      
      // Delete from Storage if exists
      if (storagePath) {
        try {
          const storageRef = ref(storage, storagePath);
          await deleteObject(storageRef);
        } catch (storageErr) {
          console.error("Error deleting from storage:", storageErr);
        }
      }

      // Update storage used
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        storageUsed: Math.max(0, (userProfile.storageUsed || 0) - photoSize)
      });

      setSelectedPhotoId(null);
      toast.success("Foto eliminada");
    } catch (error) {
      toast.error("Error al eliminar la foto");
    }
  };

  const saveCurrentAsPreset = async () => {
    if (!user || !selectedPhoto) return;
    
    const name = prompt("Nombre del Preset:");
    if (!name) return;

    const isAdmin = userProfile?.role === 'admin';
    let isSystem = false;
    let planRequired: PlanType = 'free';

    if (isAdmin) {
      const makeSystem = confirm("¿Deseas guardar este preset como PRESET DEL SISTEMA (disponible para otros usuarios)?");
      if (makeSystem) {
        isSystem = true;
        const plan = prompt("Plan requerido para este preset (free, pro, studio):", "free");
        planRequired = (['free', 'pro', 'studio'].includes(plan || '') ? plan : 'free') as PlanType;
      }
    }

    try {
      await addDoc(collection(db, "presets"), {
        userId: user.uid,
        name,
        category: isSystem ? "Sistema" : "Mis Presets",
        settings: selectedPhoto.settings,
        createdAt: serverTimestamp(),
        isSystem,
        planRequired: isSystem ? planRequired : 'free'
      });
      toast.success(isSystem ? "Preset del sistema guardado" : "Preset personal guardado");
    } catch (error) {
      toast.error("Error al guardar el preset");
    }
  };

  const applyPreset = (preset: Preset) => {
    if (!selectedPhoto) return;
    
    // Check plan requirement
    const planLevels: Record<PlanType, number> = { free: 0, pro: 1, studio: 2 };
    const userLevel = planLevels[userProfile?.plan || 'free'];
    const requiredLevel = planLevels[preset.planRequired || 'free'];

    if (userLevel < requiredLevel) {
      toast.error(`El preset "${preset.name}" requiere un plan ${preset.planRequired?.toUpperCase()}`, {
        action: {
          label: "Mejorar Plan",
          onClick: () => setShowPricing(true)
        }
      });
      return;
    }

    updatePhotoSettings(selectedPhoto.id, preset.settings);
    toast.success(`Preset "${preset.name}" aplicado`);
  };

  const handleUpgrade = async (plan: PlanType) => {
    if (!user) {
      handleLogin();
      return;
    }

    setIsProcessingPayment(true);
    try {
      const response = await fetch("/api/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planName: plan.toUpperCase(),
          price: PLAN_PRICES[plan],
          userId: user.uid
        })
      });

      const data = await response.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error("No se pudo obtener el link de pago");
      }
    } catch (error) {
      toast.error("Error al procesar el pago con Mercado Pago");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const resetSettings = (id: string) => {
    updatePhotoSettings(id, { ...DEFAULT_SETTINGS });
  };

  const smartEnhance = async (id: string, openEditor = false) => {
    setIsAutoEnhancing(true);
    if (openEditor) setSelectedPhotoId(id);
    
    // Simulate AI analysis delay only if not already in editor
    if (openEditor) {
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Natural enhancement preset
    const enhancedSettings: LightingSettings = {
      ...DEFAULT_SETTINGS,
      brightness: 115,
      contrast: 110,
      saturation: 105,
      exposure: 10,
      warmth: 5,
      highlights: 110,
      shadows: 105,
      clarity: 15,
      vibrance: 110
    };
    
    updatePhotoSettings(id, enhancedSettings);
    setIsAutoEnhancing(false);
    if (openEditor) toast.success("Iluminación optimizada automáticamente");
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    const currentIndex = photos.findIndex(p => p.id === selectedPhotoId);
    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    
    if (nextIndex >= photos.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = photos.length - 1;
    
    setSelectedPhotoId(photos[nextIndex].id);
  };

  const downloadImage = async () => {
    if (!selectedPhoto) return;
    
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    toast.promise(new Promise(async (resolve, reject) => {
      img.onload = () => {
        // Real pixel manipulation on canvas
        renderProcessedToCanvas(img, canvas, selectedPhoto.settings, 0, 0);
        
        const link = document.createElement('a');
        link.download = `aura-${selectedPhoto.title.toLowerCase().replace(/\s+/g, '-')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        resolve(true);
      };
      img.onerror = reject;
      img.src = fixImageUrl(selectedPhoto.url);
    }), {
      loading: 'Procesando píxeles y preparando descarga...',
      success: 'Fotografía procesada y descargada con éxito',
      error: 'Error al procesar la imagen para descargar.'
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500/30 flex overflow-hidden relative">
      {/* Sidebar Backdrop (Mobile) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 260 : 0,
          opacity: isSidebarOpen ? 1 : 0,
          x: isSidebarOpen ? 0 : -20
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="h-screen bg-zinc-950 border-r border-zinc-900 flex flex-col z-50 fixed lg:relative shrink-0 overflow-hidden shadow-2xl lg:shadow-none"
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-4 border-b border-zinc-900 justify-between shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20 overflow-hidden shrink-0">
              {userProfile?.plan === 'studio' && customLogo ? (
                <img src={customLogo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Sun className="w-5 h-5 text-white" />
              )}
            </div>
            <h1 className="text-sm font-bold tracking-tight text-white truncate">
              {userProfile?.plan === 'studio' && userProfile.displayName ? `${userProfile.displayName} Lab` : 'Aura Lab'}
            </h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-zinc-600 hover:text-white"
            onClick={() => setIsSidebarOpen(false)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 py-6 px-3 space-y-2 overflow-y-auto overflow-x-hidden">
          <Button 
            variant="ghost" 
            className={`w-full justify-start h-11 px-3 ${activeTab === 'gallery' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'}`}
            onClick={() => setActiveTab('gallery')}
          >
            <Layout className={`w-5 h-5 shrink-0 ${activeTab === 'gallery' ? 'text-amber-500' : ''}`} />
            {isSidebarOpen && <span className="ml-3 text-xs font-bold uppercase tracking-wider">Galería</span>}
          </Button>
          
          <Button 
            variant="ghost" 
            className={`w-full justify-start h-11 px-3 ${activeTab === 'editor' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'}`}
            onClick={() => setActiveTab('editor')}
          >
            <Settings2 className={`w-5 h-5 shrink-0 ${activeTab === 'editor' ? 'text-amber-500' : ''}`} />
            {isSidebarOpen && <span className="ml-3 text-xs font-bold uppercase tracking-wider">Editor</span>}
          </Button>

          <div className="pt-4 pb-2">
            <div className={`h-px bg-zinc-900 mx-2 ${isSidebarOpen ? 'mb-4' : 'mb-2'}`} />
            {isSidebarOpen && <p className="px-3 text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Suscripción</p>}
          </div>

          <Button 
            variant="ghost" 
            className="w-full justify-start h-11 px-3 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
            onClick={() => setShowPricing(true)}
          >
            <Zap className="w-5 h-5 shrink-0 text-purple-500" />
            {isSidebarOpen && <span className="ml-3 text-xs font-bold uppercase tracking-wider">Planes</span>}
          </Button>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-zinc-900 space-y-2">
          {user ? (
            <div className={`flex items-center gap-3 p-2 rounded-lg bg-zinc-900/30 border border-zinc-900/50 ${!isSidebarOpen ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="w-4 h-4 text-zinc-500" />
                )}
              </div>
              {isSidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-white truncate">{user.displayName}</p>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-tighter">Plan {userProfile?.plan || 'Free'}</p>
                </div>
              )}
              {isSidebarOpen && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400" onClick={() => logout()}>
                  <LogOut className="w-3 h-3" />
                </Button>
              )}
            </div>
          ) : (
            <Button 
              className="w-full bg-white text-black hover:bg-zinc-200 h-10 px-0"
              onClick={handleLogin}
            >
              <UserIcon className="w-4 h-4" />
              {isSidebarOpen && <span className="ml-2 text-[10px] font-bold uppercase">Entrar</span>}
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-full h-8 text-zinc-600 hover:text-zinc-400"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Top Header (Minimal) */}
        <header className="h-16 border-b border-zinc-900 flex items-center justify-between px-4 md:px-8 bg-zinc-950/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 text-zinc-500 hover:text-white lg:hidden"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Layout className="w-5 h-5" />
            </Button>
            <h2 className="text-[10px] md:text-sm font-bold uppercase tracking-[0.1em] md:tracking-[0.3em] text-zinc-500 truncate max-w-[150px] md:max-w-none">
              {activeTab === 'gallery' ? 'Galería de Proyectos' : 'Laboratorio de Edición'}
            </h2>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <Badge variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-500 font-mono text-[8px] md:text-[9px] px-1 md:px-2">
              v1.2.0
            </Badge>
          </div>
        </header>

        <div className={`flex-1 bg-zinc-950 ${activeTab === 'editor' ? 'h-[calc(100vh-4rem)] overflow-hidden' : 'overflow-y-auto'}`}>
          <main className={`container mx-auto ${activeTab === 'editor' ? 'h-full p-2 max-w-none' : 'px-4 md:px-8 py-8 md:py-12'}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'gallery' ? (
          <div className="space-y-12">
            {!user ? (
              /* Landing Page for non-logged users */
              <div className="max-w-4xl mx-auto text-center space-y-8 py-12">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold uppercase tracking-widest"
                >
                  <Sparkles className="w-3 h-3" />
                  Tecnología Aura v1.2
                </motion.div>
                <h2 className="text-5xl md:text-7xl font-light tracking-tight text-white leading-tight">
                  La luz perfecta para cada <span className="text-amber-500 italic font-medium">fotografía</span>.
                </h2>
                <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
                  Aura Lab es el laboratorio digital definitivo para fotógrafos. Ajusta la iluminación, recupera sombras y realza detalles con precisión profesional.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                  <Button 
                    size="lg" 
                    className="bg-white text-black hover:bg-zinc-200 h-14 px-8 text-sm font-bold uppercase tracking-wider"
                    onClick={handleLogin}
                  >
                    Empezar Gratis
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="border-zinc-800 text-zinc-400 hover:bg-zinc-900 h-14 px-8 text-sm font-bold uppercase tracking-wider"
                    onClick={() => setShowPricing(true)}
                  >
                    Ver Planes
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12">
                  {[
                    { icon: Sun, title: "Luz Natural", desc: "Algoritmos que respetan la física de la luz." },
                    { icon: Zap, title: "Procesado Rápido", desc: "Resultados instantáneos en alta resolución." },
                    { icon: ShieldCheck, title: "Galería Privada", desc: "Tus proyectos seguros y siempre disponibles." }
                  ].map((feature, i) => (
                    <div key={i} className="p-6 rounded-2xl bg-zinc-900/30 border border-zinc-900 space-y-3">
                      <feature.icon className="w-6 h-6 text-amber-500 mx-auto" />
                      <h4 className="text-white font-bold text-sm uppercase tracking-wider">{feature.title}</h4>
                      <p className="text-zinc-500 text-xs leading-relaxed">{feature.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Dashboard for logged users */
              <div className="space-y-12">
                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-zinc-900/50 border-zinc-800 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Total Fotos</p>
                        <p className="text-xl font-bold text-white">{photos.length}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="bg-zinc-900/50 border-zinc-800 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <HardDrive className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Espacio</p>
                        <div className="flex items-end justify-between">
                          <p className="text-xl font-bold text-white">{(userProfile?.storageUsed || 0) / (1024 * 1024) < 1 ? '0' : ((userProfile?.storageUsed || 0) / (1024 * 1024)).toFixed(1)}MB</p>
                          <p className="text-[9px] text-zinc-500 mb-1">de {userProfile?.plan === 'studio' ? '1TB' : userProfile?.plan === 'pro' ? '50GB' : '2GB'}</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                  <Card className="bg-zinc-900/50 border-zinc-800 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Plan Activo</p>
                        <p className="text-xl font-bold text-white uppercase">{userProfile?.plan || 'Free'}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="bg-zinc-900/50 border-zinc-800 p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors" onClick={() => setShowPricing(true)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Suscripción</p>
                        <p className="text-xs font-medium text-green-500">Gestionar Plan →</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Upload Section */}
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-12 text-center space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">Tu Laboratorio de Luz</h3>
                    <p className="text-zinc-400 text-sm max-w-md mx-auto">
                      Sube tus fotografías para empezar a ajustar la iluminación con tecnología Aura.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto">
                    <input 
                      type="text" 
                      placeholder="Pega el enlace de tu foto aquí..." 
                      className="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                      value={newPhotoUrl}
                      onChange={(e) => setNewPhotoUrl(e.target.value)}
                    />
                    <Button onClick={handleUrlAdd} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-500 text-white h-11 px-6">
                      <Plus className="w-4 h-4 mr-2" />
                      Añadir Foto
                    </Button>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                    <span>O</span>
                    <div className="h-px w-8 bg-zinc-800" />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="text-amber-500 hover:text-amber-400 transition-colors"
                    >
                      Subir archivo local
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.arw,.cr2,.nef,.dng,.orf,.raf" onChange={handleFileUpload} />
                  </div>

                  {isUploading && (
                    <div className="max-w-md mx-auto space-y-2 pt-4">
                      <div className="flex items-center justify-between text-[10px] uppercase font-bold text-amber-500">
                        <span className="flex items-center gap-2">
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                            <RotateCcw className="w-3 h-3" />
                          </motion.div>
                          Subiendo a la nube...
                        </span>
                        <span>{Math.round(uploadProgress)}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-1 bg-zinc-800" />
                    </div>
                  )}
                </div>

                {/* Gallery Grid */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Tus Fotografías</h4>
                    <div className="h-px flex-1 bg-zinc-900 mx-4 hidden sm:block"></div>
                  </div>
                  
                  {photos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {photos.map((photo) => (
                        <motion.div
                          key={photo.id}
                          layoutId={photo.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="group relative aspect-[4/5] bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-amber-500/50 transition-all shadow-2xl"
                        >
                          <div className="w-full h-full relative">
                            {photo.thumbnailUrl || !/\.(arw|cr2|nef|dng|orf|raf)$/i.test(photo.url) ? (
                              <img 
                                src={fixImageUrl(photo.thumbnailUrl || photo.url)} 
                                alt={photo.title}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                style={{ filter: getFilterString(photo.settings) }}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-zinc-500">
                                <ImageIcon className="w-12 h-12 mb-2 opacity-20" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">RAW File</span>
                                <span className="text-[8px] opacity-50 mt-1">Sin previsualización</span>
                              </div>
                            )}
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                            <h5 className="text-white font-bold text-sm mb-1">{photo.title}</h5>
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm" 
                                className="flex-1 bg-white text-black hover:bg-zinc-200 h-8 text-[10px] uppercase font-bold"
                                onClick={() => {
                                  setSelectedPhotoId(photo.id);
                                  setActiveTab('editor');
                                }}
                              >
                                Editar Luz
                              </Button>
                              <Button 
                                size="icon" 
                                variant="destructive" 
                                className="h-8 w-8"
                                onClick={() => deletePhoto(photo.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-32 border-2 border-dashed border-zinc-900 rounded-3xl">
                      <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-6">
                        <ImageIcon className="w-8 h-8 text-zinc-700" />
                      </div>
                      <h4 className="text-white font-bold text-lg mb-2">Tu galería está vacía</h4>
                      <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                        Empieza subiendo tu primera fotografía para verla aquí.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Editor View */
          <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden p-1">
            {/* Main Editor Area */}
            <div className="flex-1 flex flex-col gap-4 h-full min-w-0 overflow-hidden">
              <div className="flex items-center justify-between shrink-0">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveTab('gallery')}
                  className="text-zinc-500 hover:text-white"
                >
                  ← Volver a Galería
                </Button>
                <div className="flex items-center gap-1 md:gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={`h-8 md:h-9 border-zinc-800 text-zinc-400 hover:bg-zinc-900 ${!showControls ? 'bg-zinc-900 text-amber-500' : ''}`}
                    onClick={() => setShowControls(!showControls)}
                  >
                    <Settings2 className="w-3 h-3 md:mr-2" />
                    <span className="hidden md:inline">{showControls ? 'Ocultar Controles' : 'Mostrar Controles'}</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 md:h-9 border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                    onClick={() => selectedPhoto && resetSettings(selectedPhoto.id)}
                  >
                    <RotateCcw className="w-3 h-3 md:mr-2" />
                    <span className="hidden md:inline">Resetear</span>
                  </Button>
                  <Button 
                    size="sm" 
                    className="h-8 md:h-9 bg-amber-600 hover:bg-amber-500 text-white"
                    onClick={() => selectedPhoto && downloadImage()}
                  >
                    <Download className="w-3 h-3 md:mr-2" />
                    <span className="hidden md:inline">Exportar</span>
                  </Button>
                </div>
              </div>

              <div className="relative flex-1 bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-900 shadow-2xl flex items-center justify-center min-h-0">
                {!selectedPhoto ? (
                  <div className="text-center p-8">
                    <ImageIcon className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-500">Selecciona una foto de tu galería para empezar a editar.</p>
                    <Button 
                      variant="outline" 
                      className="mt-4 border-zinc-800"
                      onClick={() => setActiveTab('gallery')}
                    >
                      Ir a Galería
                    </Button>
                  </div>
                ) : (
                  <ImageCanvas 
                    imageUrl={fixImageUrl(selectedPhoto.thumbnailUrl || selectedPhoto.url)} 
                    title={selectedPhoto.title} 
                    settings={selectedPhoto.settings} 
                    onResetZoom={resetZoom}
                  />
                )}
              </div>
            </div>

            {/* Controls Sidebar */}
            {showControls && (
              <motion.div 
                initial={{ x: 320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 320, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="w-full lg:w-80 h-full border border-zinc-800 rounded-2xl bg-zinc-950 flex flex-col overflow-hidden shadow-2xl shrink-0"
              >
                <Tabs defaultValue="adjust" className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <TabsList className="w-full bg-zinc-900 border-b border-zinc-800 rounded-none h-12 shrink-0">
                    <TabsTrigger value="adjust" className="flex-1 text-[10px] uppercase tracking-widest data-[state=active]:bg-zinc-800">Ajustes</TabsTrigger>
                    <TabsTrigger value="presets" className="flex-1 text-[10px] uppercase tracking-widest data-[state=active]:bg-zinc-800">Presets</TabsTrigger>
                  </TabsList>

                  <TabsContent value="adjust" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 space-y-6 m-0 focus:outline-none">
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4 flex items-center gap-2">
                        <ImageIcon className="w-3 h-3" />
                        Histograma de Iluminación
                      </h4>
                      {selectedPhoto && <Histogram settings={selectedPhoto.settings} />}
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4 flex items-center gap-2">
                        <Sparkles className="w-3 h-3" />
                        Mejora Inteligente
                      </h4>
                      <Button 
                        className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white h-12 relative overflow-hidden group"
                        onClick={() => selectedPhoto && smartEnhance(selectedPhoto.id)}
                        disabled={isAutoEnhancing}
                      >
                        {isAutoEnhancing ? (
                          <div className="flex items-center gap-2">
                            <motion.div 
                              animate={{ rotate: 360 }} 
                              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </motion.div>
                            Analizando...
                          </div>
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                            Optimizar Iluminación
                          </>
                        )}
                      </Button>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                          Ajustes Manuales
                        </h4>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[9px] text-zinc-500 hover:text-amber-500"
                          onClick={saveCurrentAsPreset}
                        >
                          <Save className="w-3 h-3 mr-1" />
                          Guardar Preset
                        </Button>
                      </div>
                      {selectedPhoto && (
                        <LightingControls 
                          settings={selectedPhoto.settings} 
                          onChange={(s) => updatePhotoSettings(selectedPhoto.id, s)} 
                          userPlan={userProfile?.plan || 'studio'}
                        />
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="presets" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 space-y-6 m-0 focus:outline-none">
                    <div className="space-y-6">
                      {/* System Presets */}
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4">Presets del Sistema</h4>
                        <div className="grid grid-cols-1 gap-2">
                          {[...SYSTEM_PRESETS, ...userPresets.filter(p => p.isSystem)].map((preset) => {
                            const isLocked = false;

                            return (
                              <Button
                                key={preset.id}
                                variant="outline"
                                className={`h-auto py-3 px-4 justify-between border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-left ${isLocked ? 'opacity-60 grayscale' : ''}`}
                                onClick={() => applyPreset(preset)}
                              >
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-zinc-200">{preset.name}</span>
                                  <span className="text-[9px] text-zinc-500 uppercase tracking-tighter">{preset.category}</span>
                                </div>
                                {isLocked ? (
                                  <div className="flex items-center gap-1.5">
                                    <Lock className="w-3 h-3 text-zinc-500" />
                                    <Badge variant="outline" className="text-[8px] h-4 px-1 border-amber-500/30 text-amber-500">
                                      {preset.planRequired?.toUpperCase()}
                                    </Badge>
                                  </div>
                                ) : (
                                  <ChevronRight className="w-3 h-3 text-zinc-600" />
                                )}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      {/* User Presets */}
                      {userPresets.filter(p => !p.isSystem).length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4">Mis Presets</h4>
                          <div className="grid grid-cols-1 gap-2">
                            {userPresets.filter(p => !p.isSystem).map((preset) => (
                              <Button
                                key={preset.id}
                                variant="outline"
                                className="h-auto py-3 px-4 justify-between border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-left"
                                onClick={() => applyPreset(preset)}
                              >
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-zinc-200">{preset.name}</span>
                                  <span className="text-[9px] text-zinc-500 uppercase tracking-tighter">Personalizado</span>
                                </div>
                                <ChevronRight className="w-3 h-3 text-zinc-600" />
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
                
                <div className="p-6 border-t border-zinc-800 bg-zinc-950/50 space-y-4">
                  {userProfile && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold">
                        <span className="text-zinc-500">Almacenamiento</span>
                        <span className="text-zinc-400">
                          {(userProfile.storageUsed / (1024 * 1024)).toFixed(1)}MB / 
                          {userProfile.plan === 'studio' ? '1TB' : userProfile.plan === 'pro' ? '50GB' : '2GB'}
                        </span>
                      </div>
                      <Progress 
                        value={(userProfile.storageUsed / STORAGE_LIMITS[userProfile.plan]) * 100} 
                        className="h-1 bg-zinc-800"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <ImageIcon className="w-3 h-3" />
                      <span className="text-[10px] uppercase tracking-wider font-medium">Información</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-zinc-300">{selectedPhoto?.title}</p>
                      <p className="text-[10px] text-zinc-500 leading-relaxed">{selectedPhoto?.description}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  </main>
    </div>
  </div>

  <Toaster position="bottom-right" theme="dark" />

      {/* Pricing Dialog */}
      <Dialog open={showPricing} onOpenChange={setShowPricing}>
        <DialogContent className="max-w-[95vw] w-full lg:max-w-[1200px] h-[95vh] md:h-auto md:max-h-[90vh] overflow-hidden bg-zinc-950 border-zinc-800 text-white flex flex-col p-0 shadow-2xl shadow-black/50">
          <div className="absolute top-4 right-4 md:top-6 md:right-6 z-50">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-zinc-500 hover:text-white h-9 w-9 md:h-10 md:w-10 rounded-full bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 hover:scale-110 transition-all"
              onClick={() => setShowPricing(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 md:p-16 scrollbar-thin scrollbar-thumb-zinc-800">
            <DialogHeader className="mb-8 md:mb-12">
              <div className="flex justify-center mb-4">
                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-3 py-0.5 md:px-4 md:py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest">
                  Planes Premium
                </Badge>
              </div>
              <DialogTitle className="text-2xl md:text-5xl font-black text-center bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-transparent tracking-tight leading-tight px-4">
                Potencia tu Flujo de Trabajo
              </DialogTitle>
              <DialogDescription className="text-center text-zinc-400 text-sm md:text-xl mt-3 md:mt-4 max-w-2xl mx-auto leading-relaxed px-4">
                Elige la herramienta perfecta para tus necesidades. Desde aficionados hasta estudios profesionales.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-8 md:mb-12 max-w-6xl mx-auto px-2 md:px-0">
              {/* Free Plan */}
              <Card className="bg-zinc-900/30 border-zinc-800/50 p-6 md:p-8 flex flex-col hover:bg-zinc-900/50 transition-all duration-500 group hover:border-zinc-700">
                <div className="mb-6 md:mb-8">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Zap className="w-5 h-5 md:w-6 md:h-6 text-zinc-400" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-zinc-100">Free</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl md:text-4xl font-black text-white">$0</span>
                    <span className="text-xs md:text-sm font-medium text-zinc-500">/siempre</span>
                  </div>
                </div>
                <ul className="space-y-4 md:space-y-5 mb-8 md:mb-10 flex-1">
                  <li className="text-sm md:text-base flex items-center gap-3 md:gap-4 text-zinc-400">
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-zinc-500" />
                    </div>
                    2GB Almacenamiento
                  </li>
                  <li className="text-sm md:text-base flex items-center gap-3 md:gap-4 text-zinc-400">
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-zinc-500" />
                    </div>
                    Edición Básica
                  </li>
                  <li className="text-sm md:text-base flex items-center gap-3 md:gap-4 text-zinc-400">
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-zinc-500" />
                    </div>
                    Presets Gratuitos
                  </li>
                </ul>
                <Button 
                  variant="outline" 
                  className="w-full border-zinc-800 hover:bg-zinc-800 h-12 md:h-14 text-sm md:text-base font-bold rounded-xl transition-all" 
                  disabled={userProfile?.plan === 'free'}
                >
                  {userProfile?.plan === 'free' ? 'Tu Plan Actual' : 'Elegir Free'}
                </Button>
              </Card>

              {/* Pro Plan */}
              <Card className={`bg-zinc-900/40 p-6 md:p-8 flex flex-col relative overflow-hidden transition-all duration-500 hover:bg-zinc-900/60 group ${userProfile?.plan === 'pro' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-zinc-800 hover:border-amber-500/30'}`}>
                <div className="absolute top-0 right-0 bg-amber-500 text-black text-[8px] md:text-[10px] font-black px-3 py-1 md:px-4 md:py-1.5 rounded-bl-xl uppercase tracking-widest">Popular</div>
                <div className="mb-6 md:mb-8">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-zinc-100">Pro</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl md:text-4xl font-black text-white">${PLAN_PRICES.pro}</span>
                    <span className="text-xs md:text-sm font-medium text-zinc-500">ARS/mes</span>
                  </div>
                </div>
                <ul className="space-y-4 md:space-y-5 mb-8 md:mb-10 flex-1">
                  <li className="text-sm md:text-base flex items-center gap-3 md:gap-4 text-zinc-200">
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-amber-500" />
                    </div>
                    50GB Almacenamiento
                  </li>
                  <li className="text-sm md:text-base flex items-center gap-3 md:gap-4 text-zinc-200">
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-amber-500" />
                    </div>
                    Presets Pro Ilimitados
                  </li>
                  <li className="text-sm md:text-base flex items-center gap-3 md:gap-4 text-zinc-200">
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-amber-500" />
                    </div>
                    Sin Marcas de Agua
                  </li>
                </ul>
                <Button 
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black h-12 md:h-14 text-sm md:text-base font-black rounded-xl shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  onClick={() => handleUpgrade('pro')}
                  disabled={isProcessingPayment || userProfile?.plan === 'pro'}
                >
                  {isProcessingPayment ? "Procesando..." : userProfile?.plan === 'pro' ? "Tu Plan Actual" : "Actualizar a Pro"}
                </Button>
              </Card>

              {/* Studio Plan */}
              <Card className={`bg-zinc-900/30 border-zinc-800/50 p-6 md:p-8 flex flex-col relative overflow-hidden transition-all duration-500 hover:bg-zinc-900/50 group hover:border-zinc-700 ${userProfile?.plan === 'studio' ? 'border-amber-500 ring-2 ring-amber-500/20' : ''}`}>
                <div className="mb-6 md:mb-8">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Crown className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-zinc-100">Studio</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl md:text-4xl font-black text-white">${PLAN_PRICES.studio}</span>
                    <span className="text-xs md:text-sm font-medium text-zinc-500">ARS/mes</span>
                  </div>
                </div>
                <ul className="space-y-4 md:space-y-5 mb-8 md:mb-10 flex-1">
                  <li className="text-sm md:text-base flex items-center gap-3 md:gap-4 text-zinc-300">
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-amber-500" />
                    </div>
                    1TB Almacenamiento
                  </li>
                  <li className="text-sm md:text-base flex items-center gap-3 md:gap-4 text-zinc-300">
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-amber-500" />
                    </div>
                    Marca Blanca (Logo Propio)
                  </li>
                  <li className="text-sm md:text-base flex items-center gap-3 md:gap-4 text-zinc-300">
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-amber-500" />
                    </div>
                    Soporte Prioritario 24/7
                  </li>
                </ul>
                <Button 
                  variant={userProfile?.plan === 'studio' ? "default" : "outline"}
                  className={`w-full h-12 md:h-14 text-sm md:text-base font-bold rounded-xl transition-all ${userProfile?.plan === 'studio' ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-xl shadow-amber-500/20' : 'border-zinc-800 hover:bg-zinc-800'}`}
                  onClick={() => handleUpgrade('studio')}
                  disabled={isProcessingPayment || userProfile?.plan === 'studio'}
                >
                  {isProcessingPayment ? "Procesando..." : userProfile?.plan === 'studio' ? "Tu Plan Actual" : "Elegir Studio"}
                </Button>
              </Card>
            </div>

            <div className="flex flex-col items-center justify-center gap-4 text-sm text-zinc-500 border-t border-zinc-900/50 pt-12 mt-8 pb-8 md:pb-0">
              <div className="flex items-center gap-3 bg-zinc-900/50 px-6 py-2 rounded-full border border-zinc-800">
                <CreditCard className="w-5 h-5 text-zinc-400" />
                <span className="text-[10px] md:text-sm font-medium">Pagos seguros vía Mercado Pago</span>
              </div>
              <p className="text-zinc-600 text-center text-[10px] md:text-xs max-w-md px-4">
                Tu suscripción se renovará automáticamente. Puedes cancelar o cambiar de plan en cualquier momento desde tu perfil.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
