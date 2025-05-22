document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('myCanvas');
    const ctx = canvas.getContext('2d');

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    ctx.strokeStyle = '#FFFFFF'; // Default stroke color (white)
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        [lastX, lastY] = [e.offsetX, e.offsetY];
    });

    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mouseout', () => isDrawing = false);

    // Basic controls example (you can add more sophisticated tools)
    // For example, buttons for changing color, line width, etc.
    // console.log("Canvas initialized. Start drawing!");
});
