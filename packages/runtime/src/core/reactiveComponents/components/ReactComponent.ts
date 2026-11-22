import { ComponentType, createElement } from "react";
import { createRoot } from "react-dom/client";

export function implementReactComponents(components: ComponentType[]) {
    const cleanups: (() => void)[] = [];
    components.forEach(component => {
        const componentRoot = document.createElement('div');
        document.body.appendChild(componentRoot);

        const root = createRoot(componentRoot);
        root.render(createElement(component));
        cleanups.push(() => {
            root.unmount();
            componentRoot.remove();
        });
    });
    return () => cleanups.forEach(cleanup => cleanup());
}
