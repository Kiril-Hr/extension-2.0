import {ComponentType, createElement, ReactNode} from "react";
import {createPortal} from "react-dom";

export function implementReactComponents(components: ComponentType[]) {
    components.forEach(component => {
        const pseudoUniqueID = Math.ceil(Math.random() * 1000)
        const componentRoot = document.createElement('div');
        componentRoot.setAttribute('id', 'react-element_' + pseudoUniqueID)
        document.body.appendChild(componentRoot);

        const reactNode: ReactNode = createElement(component);
        createPortal(reactNode, componentRoot);
    });
}
