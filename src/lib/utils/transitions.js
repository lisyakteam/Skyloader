function springOut(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function slideFade(node, params) {
    const delay = params.delay || 0;
    const duration = params.duration || 100;
    const easing = params.easing || springOut;

    return {
        delay,
        duration,
        css: (t, u) => {
            const eased = easing(t);
            return `
            transform: translateY(${(1 - eased) * 20}px);
            opacity: ${eased};
            `;
        }
    };
}
