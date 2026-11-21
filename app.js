let items = [];

// Generar folio aleatorio para pedidos de pastelería
function generarFolio() {
    const ahora = new Date();
    const num = Math.floor(100 + Math.random() * 900);
    return `PAS-${ahora.getFullYear()}${num}`;
}

// Formato de moneda con comas
function formatoMoneda(valor) {
    return valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Limpiar texto para nombres de archivo seguros
function limpiarNombreArchivo(texto) {
    return (texto || 'Cliente')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]/g, '_');
}

// Convertir DataURL a Blob de forma segura
function dataUrlABlob(dataUrl) {
    const partes = dataUrl.split(',');
    const mimeMatch = partes[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const binStr = atob(partes[1]);
    const len = binStr.length;
    const u8arr = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
        u8arr[i] = binStr.charCodeAt(i);
    }

    return new Blob([u8arr], { type: mime });
}

// Descargar imagen y abrir WhatsApp con resumen como respaldo
async function respaldarDescargaYWhatsApp(blob, nombreImagen, resumenTexto) {
    const urlDescarga = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = urlDescarga;
    enlace.download = nombreImagen;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    setTimeout(() => URL.revokeObjectURL(urlDescarga), 4000);

    await Swal.fire({
        icon: 'info',
        title: 'Imagen lista para enviar',
        text: `Se descargó ${nombreImagen}. Se abrirá WhatsApp para que adjuntes la imagen junto con el resumen.`,
        confirmButtonText: 'Abrir WhatsApp'
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(resumenTexto)}`, '_blank');
}

// Notificación rápida tipo "Toast"
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true
});

// Inicializar folio y fecha de emisión
const folioInicial = generarFolio();
document.getElementById('folio').value = folioInicial;
document.getElementById('res-folio').textContent = folioInicial;

const hoy = new Date().toLocaleDateString('es-MX');
document.getElementById('res-fecha-emision').textContent = hoy;

// Sincronizar campos de encabezado en tiempo real
const enlacesCampos = [
    { input: 'cliente', destino: 'res-cliente', defecto: '---' },
    { input: 'fecha-entrega', destino: 'res-fecha-entrega', defecto: 'Por definir' },
    { input: 'hora-entrega', destino: 'res-hora-entrega', defecto: '---' },
    { input: 'tipo-pedido', destino: 'res-tipo-pedido', defecto: 'Pastel Entero' },
    { input: 'modalidad-entrega', destino: 'res-modalidad-entrega', defecto: 'Recoger en local' },
    { input: 'dedicatoria', destino: 'res-dedicatoria', defecto: '---' },
    { input: 'validez', destino: 'res-validez', defecto: '7' }
];

enlacesCampos.forEach(par => {
    const elInput = document.getElementById(par.input);
    const elDestino = document.getElementById(par.destino);

    const actualizarCampo = () => {
        elDestino.textContent = elInput.value || par.defecto;
    };

    elInput.addEventListener('input', actualizarCampo);
    elInput.addEventListener('change', actualizarCampo);
});

// Selector rápido de pasteles y rebanadas
document.getElementById('plantilla-producto').addEventListener('change', function() {
    if (!this.value) return;
    const [nombre, precio] = this.value.split('|');
    document.getElementById('descripcion').value = nombre;
    document.getElementById('precio').value = precio;
    document.getElementById('cantidad').value = 1;
});

// Agregar pastel o rebanada al pedido
document.getElementById('btn-agregar').addEventListener('click', () => {
    const desc = document.getElementById('descripcion').value.trim();
    const cant = parseFloat(document.getElementById('cantidad').value);
    const precio = parseFloat(document.getElementById('precio').value);

    if (!desc || isNaN(cant) || isNaN(precio) || cant <= 0 || precio < 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Faltan datos',
            text: 'Por favor escribe el producto, la cantidad y el precio unitario.',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    items.push({ desc, cant, precio, importe: cant * precio });

    document.getElementById('plantilla-producto').value = '';
    document.getElementById('descripcion').value = '';
    document.getElementById('cantidad').value = '1';
    document.getElementById('precio').value = '';

    actualizarTodo();

    Toast.fire({
        icon: 'success',
        title: 'Agregado al pedido'
    });
});

// Eliminar producto
window.eliminarItem = function(index) {
    items.splice(index, 1);
    actualizarTodo();
};

// Escuchar cambios en envío, IVA y porcentaje de anticipo
['costo-envio', 'porcentaje-anticipo'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcularTotales);
    document.getElementById(id).addEventListener('change', calcularTotales);
});
document.getElementById('aplicar-iva').addEventListener('change', calcularTotales);

function actualizarTodo() {
    const tbody = document.getElementById('lista-items');
    tbody.innerHTML = '';

    items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.cant}</td>
            <td>${item.desc}</td>
            <td>$${formatoMoneda(item.precio)}</td>
            <td>$${formatoMoneda(item.importe)}</td>
            <td class="no-print">
                <button type="button" class="btn-borrar-item" onclick="eliminarItem(${index})">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    calcularTotales();
}

function obtenerCalculos() {
    const subtotal = items.reduce((suma, item) => suma + item.importe, 0);
    const envio = Math.max(0, parseFloat(document.getElementById('costo-envio').value) || 0);
    const llevaIva = document.getElementById('aplicar-iva').checked;
    const baseConEnvio = subtotal + envio;
    const iva = llevaIva ? baseConEnvio * 0.16 : 0;
    const total = baseConEnvio + iva;

    const porcAnticipo = Math.min(100, Math.max(0, parseFloat(document.getElementById('porcentaje-anticipo').value) || 0));
    const anticipo = total * (porcAnticipo / 100);
    const saldo = total - anticipo;

    return { subtotal, envio, llevaIva, iva, total, porcAnticipo, anticipo, saldo };
}

function calcularTotales() {
    const { subtotal, envio, llevaIva, iva, total, porcAnticipo, anticipo, saldo } = obtenerCalculos();

    document.getElementById('fila-envio').style.display = envio > 0 ? 'flex' : 'none';
    document.getElementById('fila-iva').style.display = llevaIva ? 'flex' : 'none';

    document.getElementById('calc-subtotal').textContent = formatoMoneda(subtotal);
    document.getElementById('calc-envio').textContent = formatoMoneda(envio);
    document.getElementById('calc-iva').textContent = formatoMoneda(iva);
    document.getElementById('calc-total').textContent = formatoMoneda(total);

    document.getElementById('res-porc-anticipo').textContent = porcAnticipo;
    document.getElementById('res-porc-nota').textContent = porcAnticipo;
    document.getElementById('calc-anticipo').textContent = formatoMoneda(anticipo);
    document.getElementById('calc-saldo').textContent = formatoMoneda(saldo);
}

// Respaldo directo con jsPDF
function generarPdfDirecto(nombreArchivo) {
    const jsPDFConstructor =
        (window.jspdf && window.jspdf.jsPDF) ||
        (html2pdf && html2pdf.jsPDF);

    if (!jsPDFConstructor) {
        throw new Error('jsPDF no disponible');
    }

    const doc = new jsPDFConstructor({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    // Dentro de generarPdfDirecto(nombreArchivo)
    const negocio = (document.querySelector('.nombre-negocio')?.textContent || 'ROCA CAKE REPOSTERÍA').trim();
    const folio = document.getElementById('folio').value;
    const fechaEmision = document.getElementById('res-fecha-emision').textContent;
    const cliente = document.getElementById('cliente').value.trim() || '---';
    const fechaEntrega = document.getElementById('fecha-entrega').value || 'Por definir';
    const horaEntrega = document.getElementById('hora-entrega').value || '---';
    const tipoPedido = document.getElementById('tipo-pedido').value;
    const modalidadEntrega = document.getElementById('modalidad-entrega').value;
    const dedicatoria = document.getElementById('dedicatoria').value.trim() || '---';
    const validez = document.getElementById('validez').value || '7';
    const { subtotal, envio, llevaIva, iva, total, porcAnticipo, anticipo, saldo } = obtenerCalculos();

    let y = 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(74, 44, 29);
    doc.text(negocio, 15, y);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(125, 98, 82);
    doc.text(`Folio: ${folio}`, 195, y - 3, { align: 'right' });
    doc.text(`Fecha: ${fechaEmision}`, 195, y + 3, { align: 'right' });

    y += 12;
    doc.setDrawColor(217, 195, 168);
    doc.line(15, y, 195, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(59, 40, 30);
    doc.text(`Cliente: ${cliente}`, 15, y);
    doc.text(`Fecha de entrega: ${fechaEntrega}`, 110, y);
    y += 6;
    doc.text(`Modalidad: ${tipoPedido}`, 15, y);
    doc.text(`Hora / Entrega: ${horaEntrega} · ${modalidadEntrega}`, 110, y);
    y += 6;
    doc.text(`Dedicatoria / Notas: ${dedicatoria}`, 15, y);
    y += 10;

    doc.setFillColor(74, 44, 29);
    doc.setTextColor(255, 250, 242);
    doc.setFont('helvetica', 'bold');
    doc.rect(15, y - 5, 180, 7, 'F');
    doc.text('Cant.', 17, y);
    doc.text('Producto', 35, y);
    doc.text('P. Unit', 142, y, { align: 'right' });
    doc.text('Importe', 192, y, { align: 'right' });
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(59, 40, 30);

    items.forEach(item => {
        if (y > 255) {
            doc.addPage();
            y = 20;
        }
        const descCorta = item.desc.length > 48 ? `${item.desc.slice(0, 48)}...` : item.desc;
        doc.text(String(item.cant), 17, y);
        doc.text(descCorta, 35, y);
        doc.text(`$${formatoMoneda(item.precio)}`, 142, y, { align: 'right' });
        doc.text(`$${formatoMoneda(item.importe)}`, 192, y, { align: 'right' });
        doc.setDrawColor(239, 229, 216);
        doc.line(15, y + 2, 195, y + 2);
        y += 7;
    });

    y += 4;
    doc.text('Subtotal:', 135, y);
    doc.text(`$${formatoMoneda(subtotal)}`, 192, y, { align: 'right' });

    if (envio > 0) {
        y += 6;
        doc.text('Envío:', 135, y);
        doc.text(`$${formatoMoneda(envio)}`, 192, y, { align: 'right' });
    }

    if (llevaIva) {
        y += 6;
        doc.text('IVA (16%):', 135, y);
        doc.text(`$${formatoMoneda(iva)}`, 192, y, { align: 'right' });
    }

    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(74, 44, 29);
    doc.text('TOTAL:', 135, y);
    doc.text(`$${formatoMoneda(total)}`, 192, y, { align: 'right' });

    y += 7;
    doc.setFontSize(10);
    doc.setTextColor(47, 133, 90);
    doc.text(`Anticipo (${porcAnticipo}%):`, 135, y);
    doc.text(`$${formatoMoneda(anticipo)}`, 192, y, { align: 'right' });

    y += 6;
    doc.setTextColor(125, 98, 82);
    doc.text('Saldo restante:', 135, y);
    doc.text(`$${formatoMoneda(saldo)}`, 192, y, { align: 'right' });

    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`* Cotización válida por ${validez} días naturales.`, 15, y);
    doc.text(`* Se requiere el ${porcAnticipo}% de anticipo para apartar o preparar su pedido.`, 15, y + 5);

    doc.save(nombreArchivo);
}

// Descargar PDF
document.getElementById('btn-pdf').addEventListener('click', async () => {
    if (items.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Cotización vacía',
            text: 'Agrega al menos un pastel o rebanada antes de descargar el PDF.',
            confirmButtonText: 'De acuerdo'
        });
        return;
    }

    Swal.fire({
        title: 'Creando PDF...',
        text: 'Preparando la cotización de pastelería',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    window.scrollTo(0, 0);

    const botonesBorrar = document.querySelectorAll('.no-print');
    botonesBorrar.forEach(btn => btn.style.display = 'none');

    const elemento = document.getElementById('area-impresion');
    const estiloPrevio = {
        boxShadow: elemento.style.boxShadow,
        borderRadius: elemento.style.borderRadius,
        backgroundColor: elemento.style.backgroundColor
    };

    elemento.style.boxShadow = 'none';
    elemento.style.borderRadius = '0';
    elemento.style.backgroundColor = '#ffffff';

    const clienteLimpio = limpiarNombreArchivo(document.getElementById('cliente').value);
    const folio = document.getElementById('folio').value;
    const nombreArchivo = `${folio}_${clienteLimpio}.pdf`;

    await new Promise(resolve => setTimeout(resolve, 150));

    const opciones = {
        margin: [10, 10, 10, 10],
        filename: nombreArchivo,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 1.5,
            useCORS: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        const worker = html2pdf().set(opciones).from(elemento);
        const canvas = await worker.toCanvas().get('canvas');

        if (!canvas || canvas.height < 50) {
            generarPdfDirecto(nombreArchivo);
        } else {
            await worker.save();
        }

        Swal.fire({
            icon: 'success',
            title: '¡Cotización Descargada!',
            text: `El archivo ${nombreArchivo} se guardó en tu dispositivo.`,
            confirmButtonText: 'Excelente'
        });
    } catch (error) {
        try {
            generarPdfDirecto(nombreArchivo);
            Swal.fire({
                icon: 'success',
                title: '¡Cotización Descargada!',
                text: `El archivo ${nombreArchivo} se guardó en tu dispositivo.`,
                confirmButtonText: 'Excelente'
            });
        } catch (fallbackError) {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo generar el PDF',
                text: 'Intenta de nuevo en unos segundos.',
                confirmButtonText: 'Entendido'
            });
        }
    } finally {
        elemento.style.boxShadow = estiloPrevio.boxShadow;
        elemento.style.borderRadius = estiloPrevio.borderRadius;
        elemento.style.backgroundColor = estiloPrevio.backgroundColor;
        botonesBorrar.forEach(btn => btn.style.display = '');
    }
});

// Convertir a imagen y compartir por WhatsApp
document.getElementById('btn-whatsapp').addEventListener('click', async () => {
    if (items.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Cotización vacía',
            text: 'Agrega al menos un pastel o rebanada para generar la imagen.',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    const renderCanvas = window.html2canvas || (window.html2pdf && window.html2pdf.html2canvas);
    if (!renderCanvas) {
        Swal.fire({
            icon: 'error',
            title: 'Falta librería de imagen',
            text: 'No se pudo cargar html2canvas para crear la imagen.',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    Swal.fire({
        title: 'Creando imagen...',
        text: 'Preparando la cotización para compartir',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    window.scrollTo(0, 0);

    const botonesBorrar = document.querySelectorAll('.no-print');
    botonesBorrar.forEach(btn => btn.style.display = 'none');

    const elemento = document.getElementById('area-impresion');
    const estiloPrevio = {
        boxShadow: elemento.style.boxShadow,
        borderRadius: elemento.style.borderRadius,
        backgroundColor: elemento.style.backgroundColor
    };

    elemento.style.boxShadow = 'none';
    elemento.style.borderRadius = '0';
    elemento.style.backgroundColor = '#ffffff';

    const cliente = document.getElementById('cliente').value.trim() || 'Cliente';
    const clienteLimpio = limpiarNombreArchivo(cliente);
    const folio = document.getElementById('folio').value;
    const nombreImagen = `${folio}_${clienteLimpio}.png`;

    const tipoPedido = document.getElementById('tipo-pedido').value;
    const fechaEnt = document.getElementById('fecha-entrega').value || 'Por definir';
    const { total, anticipo, porcAnticipo } = obtenerCalculos();

    // Dentro de document.getElementById('btn-whatsapp').addEventListener('click', ...)
    const resumenTexto =
        `*ROCA CAKE REPOSTERÍA - COTIZACIÓN*\n` +
        `*Folio:* ${folio}\n` +
        `*Cliente:* ${cliente}\n` +
        `*Pedido:* ${tipoPedido} (${fechaEnt})\n` +
        `*TOTAL:* $${formatoMoneda(total)}\n` +
        `*Anticipo (${porcAnticipo}%):* $${formatoMoneda(anticipo)}`;

    await new Promise(resolve => setTimeout(resolve, 150));

    try {
        const canvas = await renderCanvas(elemento, {
            scale: 1.5,
            useCORS: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0
        });

        if (!canvas || canvas.width === 0 || canvas.height === 0) {
            throw new Error('Canvas vacío');
        }

        const dataUrl = canvas.toDataURL('image/png', 0.92);
        const blob = dataUrlABlob(dataUrl);
        const archivoImagen = new File([blob], nombreImagen, { type: 'image/png' });

        Swal.close();

        let compartido = false;

        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [archivoImagen] }))) {
            try {
                await navigator.share({
                    title: `Cotización ${folio}`,
                    text: resumenTexto,
                    files: [archivoImagen]
                });
                compartido = true;
            } catch (shareError) {
                if (shareError && shareError.name === 'AbortError') {
                    return;
                }
                compartido = false;
            }
        }

        if (!compartido) {
            await respaldarDescargaYWhatsApp(blob, nombreImagen, resumenTexto);
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'No se pudo crear la imagen',
            text: 'Revisa que haya al menos un producto agregado e intenta de nuevo.',
            confirmButtonText: 'Entendido'
        });
    } finally {
        elemento.style.boxShadow = estiloPrevio.boxShadow;
        elemento.style.borderRadius = estiloPrevio.borderRadius;
        elemento.style.backgroundColor = estiloPrevio.backgroundColor;
        botonesBorrar.forEach(btn => btn.style.display = '');
    }
});

// Limpiar todo para una nueva cotización
document.getElementById('btn-limpiar').addEventListener('click', () => {
    Swal.fire({
        title: '¿Iniciar cotización nueva?',
        text: 'Se borrarán los datos del cliente y los productos actuales.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4a2c1d',
        cancelButtonColor: '#e53e3e',
        confirmButtonText: 'Sí, limpiar todo',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            items = [];
            const nuevoFolio = generarFolio();
            document.getElementById('folio').value = nuevoFolio;
            document.getElementById('res-folio').textContent = nuevoFolio;

            ['cliente', 'fecha-entrega', 'hora-entrega', 'dedicatoria'].forEach(id => {
                document.getElementById(id).value = '';
            });
            document.getElementById('costo-envio').value = '0';

            enlacesCampos.forEach(par => {
                if (!['tipo-pedido', 'modalidad-entrega', 'validez'].includes(par.input)) {
                    document.getElementById(par.destino).textContent = par.defecto;
                }
            });

            actualizarTodo();

            Swal.fire({
                icon: 'success',
                title: '¡Lista para empezar!',
                text: `Se asignó el nuevo folio ${nuevoFolio}`,
                timer: 1800,
                showConfirmButton: false
            });
        }
    });
});