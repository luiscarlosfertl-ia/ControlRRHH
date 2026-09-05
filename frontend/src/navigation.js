import { useEffect, useState } from "react";
export const normalizeView = (hash, allowed) =>
  allowed.includes(hash.replace(/^#/, ""))
    ? hash.replace(/^#/, "")
    : "dashboard";
export function useViewNavigation(allowed) {
  const [route, setRoute] = useState(() => ({
    view: normalizeView(location.hash, allowed),
    index: 0,
  }));
  useEffect(() => {
    history.replaceState(
      { ...history.state, controlNav: 0 },
      "",
      `#${normalizeView(location.hash, allowed)}`,
    );
    const sync = () =>
      setRoute({
        view: normalizeView(location.hash, allowed),
        index: history.state?.controlNav || 0,
      });
    addEventListener("popstate", sync);
    addEventListener("hashchange", sync);
    return () => {
      removeEventListener("popstate", sync);
      removeEventListener("hashchange", sync);
    };
  }, []);
  const go = (name) => {
    const view = normalizeView(name, allowed);
    if (view === route.view) return;
    if (
      document.querySelector("[data-help-scope]") &&
      !confirm("Al cambiar de vista se cerrará el diálogo. ¿Continuar?")
    )
      return false;
    const index = route.index + 1;
    history.pushState({ controlNav: index }, "", `#${view}`);
    setRoute({ view, index });
    return true;
  };
  return {
    view: route.view,
    go,
    canBack: route.index > 0,
    back: () => {
      if (
        route.index > 0 &&
        (!document.querySelector("[data-help-scope]") ||
          confirm("Al volver se cerrará el diálogo. ¿Continuar?"))
      )
        history.back();
    },
  };
}
