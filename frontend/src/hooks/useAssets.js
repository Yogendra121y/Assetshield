import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";

export function useAssets() {
  const { user } = useAuth();

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    total: 0,
    safe: 0,
    flagged: 0,
    processing: 0,
  });

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "assets"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log("🔥 Assets from Firestore:", data);

      setAssets(data);

      // Stats calculation
      const total = data.length;
      const safe = data.filter(a => a.status === "safe").length;
      const flagged = data.filter(a => a.status === "flagged").length;
      const processing = data.filter(a => a.status === "processing").length;

      setStats({ total, safe, flagged, processing });

      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { assets, loading, stats };
}