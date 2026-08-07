// Ayudante para tiempo real en móviles.
// Cuando la pestaña vuelve a primer plano, recupera el foco o se reconecta a
// internet, el navegador pudo haber pausado los timers (poll de respaldo) y la
// suscripción en vivo. En esos momentos llamamos onWake() para refrescar YA,
// así el dispositivo nunca se queda "pegado" mostrando un estado viejo.
export function onForeground(onWake: () => void): () => void {
  const handler = () => {
    // En visibilitychange solo nos interesa cuando la pestaña pasa a VISIBLE.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    onWake();
  };

  document.addEventListener("visibilitychange", handler);
  window.addEventListener("focus", handler);
  window.addEventListener("online", handler);

  return () => {
    document.removeEventListener("visibilitychange", handler);
    window.removeEventListener("focus", handler);
    window.removeEventListener("online", handler);
  };
}
