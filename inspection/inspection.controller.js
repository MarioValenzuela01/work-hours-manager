const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');

const Hour = require('../models/hours.model');

exports.loadSelectHours = (req, res) => {
    res.sendFile(path.join(__dirname, '../public/select-hours.html'));
};

exports.handleSelectHour = async (req, res) => {
    const { hourId } = req.body;

    if (!hourId) {
        return res.status(400).json({ error: 'Missing hourId' });
    }

    try {
        const hour = await Hour.findOne({ id: hourId, userId: req.userId });

        if (!hour) {
            return res.status(404).json({ error: 'Hour not found' });
        }

        const query =
            `?date=${encodeURIComponent(hour.date)}` +
            `&hourStart=${encodeURIComponent(hour.startTime)}` +
            `&hourEnd=${encodeURIComponent(hour.endTime)}` +
            `&description=${encodeURIComponent(hour.description || '')}`;

        res.redirect(`/inspection${query}`);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.loadForm = (req, res) => {
    res.sendFile(path.join(__dirname, '../public/inspection.html'));
};

exports.generatePDF = async (req, res) => {
    try {
        console.log("BODY:", req.body);

        const data = req.body;

        const existingPdfBytes = fs.readFileSync(
            path.join(__dirname, '../templates/inspection-template.pdf')
        );

        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const page = pdfDoc.getPages()[0];

        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        page.drawText(data.operator || '', { x: 140, y: 627, size: 12, font });
        page.drawText(data.date || '', { x: 443, y: 627, size: 12, font });
        page.drawText(data.size || '', { x: 142, y: 607, size: 14, font });
        page.drawText(data.serialNumber || '', { x: 303, y: 607, size: 12, font });
        page.drawText(data.hourStart || '', { x: 452, y: 607, size: 12, font });
        page.drawText(data.hourEnd || '', { x: 452, y: 587, size: 12, font });

        page.drawText("Hour End:", { x: 390, y: 587, size: 12, font });

        const drawX = (value, x, y) => {
            if (value && value.trim() !== '') {
                page.drawText('X', { x, y, size: 14, font });
            }
        };

        drawX(data.field1, 282, 566);
        drawX(data.field2, 282, 551);
        drawX(data.field3, 282, 536);
        drawX(data.field4, 282, 521);
        drawX(data.field5, 282, 506);

        drawX(data.field6, 282, 467);
        drawX(data.field7, 282, 452);
        drawX(data.field8, 282, 437);
        drawX(data.field9, 282, 422);
        drawX(data.field10, 282, 407);
        drawX(data.field11, 282, 392);
        drawX(data.field12, 282, 377);
        drawX(data.field13, 282, 362);

        drawX(data.field14, 517, 566);
        drawX(data.field15, 517, 551);
        drawX(data.field16, 517, 536);
        drawX(data.field17, 517, 521);

        drawX(data.field18, 517, 467);
        drawX(data.field19, 517, 452);
        drawX(data.field20, 517, 437);
        drawX(data.field21, 517, 422);
        drawX(data.field22, 517, 407);
        drawX(data.field23, 517, 392);
        drawX(data.field24, 517, 377);
        drawX(data.field25, 517, 362);

        drawX(data.field26, 196, 328);
        drawX(data.field27, 196, 311);
        drawX(data.field28, 196, 296);
        drawX(data.field29, 196, 279);
        drawX(data.field30, 196, 264);
        drawX(data.field31, 196, 249);
        drawX(data.field32, 196, 234);

        const drawTextField = (value, x, y, width) => {
            if (value && value.trim() !== '') {
                const size = 10;
                const textWidth = font.widthOfTextAtSize(value, size);
                const offsetX = textWidth < width ? (width - textWidth) / 2 : 0;

                page.drawText(value, {
                    x: x + offsetX,
                    y,
                    size,
                    font
                });
            }
        };

        for (let i = 33; i <= 39; i++) {
            drawTextField(data[`field${i}`], 219, 328 - ((i - 33) * 16), 99);
        }

        for (let i = 40; i <= 46; i++) {
            drawTextField(data[`field${i}`], 325, 328 - ((i - 40) * 16), 82);
        }

        for (let i = 47; i <= 53; i++) {
            drawTextField(data[`field${i}`], 414, 328 - ((i - 47) * 16), 116);
        }

        if (data.comments && data.comments.trim() !== '') {
            page.drawText(data.comments.trim(), {
                x: 87,
                y: 202,
                size: 12,
                font,
                maxWidth: 450,
                lineHeight: 14
            });
        }

        const pdfBytes = await pdfDoc.save();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=inspection.pdf');
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating PDF');
    }
};