import React, { useEffect, useState } from "react";
import { verifyToken } from "../api/auth";

function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    async function check() {
      const user = await verifyToken();
      if (user) setValid(true);
      setLoading(false);
    }
    check();
  }, []);

  if (loading) return <p>Проверка доступа...</p>;

  if (!valid) {
    window.location.href = "/login";
    return null;
  }

  return children;
}

export default ProtectedRoute;
