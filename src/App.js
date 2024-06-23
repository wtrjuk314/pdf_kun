import React, { useState, useRef, useEffect } from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { Button, Tabs, Tab, TextField, IconButton, Box, Dialog, DialogActions, DialogContent, DialogTitle, Checkbox, Typography } from '@mui/material';
import { Close, Add, ChevronLeft, ChevronRight } from '@mui/icons-material';
import TabContext from '@mui/lab/TabContext';
import TabPanel from '@mui/lab/TabPanel';
import { PDFDocument } from 'pdf-lib';
import Draggable from 'react-draggable';
import { ResizableBox } from 'react-resizable';
import 'react-resizable/css/styles.css';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';

const App = () => {
    const [tabs, setTabs] = useState([{ id: 0, pdfFile: null, checked: false }]);
    const [currentTab, setCurrentTab] = useState(0);
    const defaultLayoutPluginInstance = defaultLayoutPlugin();
    const inputRef = useRef();
    const imgInputRef = useRef();
    const [pageRange, setPageRange] = useState('');
    const [open, setOpen] = useState(false);
    const [fileName, setFileName] = useState('');
    const [imgFile, setImgFile] = useState(null);
    const [imgPosition, setImgPosition] = useState({ x: 0, y: 0 });
    const [imgSize, setImgSize] = useState({ width: 100, height: 100 });
    const [imgInitialLoad, setImgInitialLoad] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isInserting, setIsInserting] = useState(false);

    useEffect(() => {
        if (imgFile && imgInitialLoad) {
            setImgPosition({ x: 0, y: 0 });
            setImgSize({ width: 100, height: 100 });
            setImgInitialLoad(false);
        }
    }, [imgFile, imgInitialLoad]);

    const handleFileChange = (e, tabId) => {
        const file = e.target.files[0];
        const newTabs = tabs.map(tab =>
            tab.id === tabId ? { ...tab, pdfFile: URL.createObjectURL(file) } : tab
        );
        setTabs(newTabs);
    };

    const handleTabChange = (event, newValue) => {
        setCurrentTab(parseInt(newValue));
    };

    const handleAddTab = () => {
        const newTabId = tabs.length ? tabs[tabs.length - 1].id + 1 : 0;
        setTabs([...tabs, { id: newTabId, pdfFile: null, checked: false }]);
        setCurrentTab(newTabId);
    };

    const handleRemoveTab = (tabId) => {
        const newTabs = tabs.filter(tab => tab.id !== tabId);
        if (newTabs.length === 0) {
            setTabs([{ id: 0, pdfFile: null, checked: false }]);
            setCurrentTab(0);
        } else {
            setTabs(newTabs);
            if (tabId === currentTab && newTabs.length > 0) {
                setCurrentTab(newTabs[newTabs.length - 1].id);
            }
        }
    };

    const handleCheckTab = (tabId) => {
        const newTabs = tabs.map(tab =>
            tab.id === tabId ? { ...tab, checked: !tab.checked } : tab
        );
        setTabs(newTabs);
    };

    const parsePageRanges = (rangesStr) => {
        return rangesStr.split(',').map(range => {
            const [start, end] = range.split('-').map(num => parseInt(num.trim(), 10));
            if (!isNaN(start) && (isNaN(end) || end >= start)) {
                return { start, end: isNaN(end) ? start : end };
            }
            return null;
        }).filter(range => range !== null);
    };

    const handleSplitPdf = async () => {
        const tab = tabs.find(tab => tab.id === currentTab);
        const fileUrl = tab.pdfFile;
        const existingPdfBytes = await fetch(fileUrl).then(res => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        const ranges = parsePageRanges(pageRange);
        if (ranges.length === 0) {
            alert("無効なページ範囲です");
            return;
        }

        const splitPdfs = [];
        for (const { start, end } of ranges) {
            const newPdfDoc = await PDFDocument.create();
            const pages = await newPdfDoc.copyPages(pdfDoc, Array.from({ length: end - start + 1 }, (_, i) => i + start - 1));
            pages.forEach(page => newPdfDoc.addPage(page));
            const newPdfBytes = await newPdfDoc.save();
            const newPdfUrl = URL.createObjectURL(new Blob([newPdfBytes], { type: 'application/pdf' }));
            splitPdfs.push(newPdfUrl);
        }

        const newTabs = [
            ...tabs.slice(0, currentTab + 1),
            ...splitPdfs.map((pdfFile, index) => ({ id: currentTab + 1 + index, pdfFile, checked: false })),
            ...tabs.slice(currentTab + 1).map(tab => ({ ...tab, id: tab.id + splitPdfs.length }))
        ];
        setTabs(newTabs);
        setCurrentTab(currentTab + 1);
    };

    const handleRemovePages = async () => {
        const tab = tabs.find(tab => tab.id === currentTab);
        const fileUrl = tab.pdfFile;
        const existingPdfBytes = await fetch(fileUrl).then(res => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        const ranges = parsePageRanges(pageRange);
        if (ranges.length === 0 || ranges.some(range => range.end > pdfDoc.getPageCount())) {
            alert("無効なページ範囲です");
            return;
        }

        for (const { start, end } of ranges) {
            for (let i = end; i >= start; i--) {
                pdfDoc.removePage(i - 1);
            }
        }

        const pdfBytes = await pdfDoc.save();
        const newFileUrl = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
        const newTabs = tabs.map(tab =>
            tab.id === currentTab ? { ...tab, pdfFile: newFileUrl } : tab
        );
        setTabs(newTabs);
    };

    const handleMergePdfs = async () => {
        const selectedTabs = tabs.filter(tab => tab.checked);
        if (selectedTabs.length < 2) {
            alert('2つ以上のPDFを選択してください');
            return;
        }

        const mergedPdf = await PDFDocument.create();
        for (const tab of selectedTabs) {
            if (tab.pdfFile) {
                const existingPdfBytes = await fetch(tab.pdfFile).then(res => res.arrayBuffer());
                const pdfDoc = await PDFDocument.load(existingPdfBytes);
                const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }
        }
        const pdfBytes = await mergedPdf.save();
        const mergedFileUrl = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
        const newTabId = tabs.length;
        const newTabs = [{ id: newTabId, pdfFile: mergedFileUrl, checked: false }];
        setTabs(newTabs);
        setCurrentTab(newTabId);
    };

    const handleSavePdf = () => {
        setOpen(true);
    };

    const handleSave = async () => {
        const tab = tabs.find(tab => tab.id === currentTab);
        const fileUrl = tab.pdfFile;
        const existingPdfBytes = await fetch(fileUrl).then(res => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName}.pdf`;
        link.click();
        setOpen(false);
        setFileName('');
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        setImgFile(file);
        setImgInitialLoad(true);
        setIsInserting(true);
    };

    const handleInsertImage = async () => {
        if (!isInserting) {
            setIsInserting(true);
            return;
        }

        const tab = tabs.find(tab => tab.id === currentTab);
        const fileUrl = tab.pdfFile;
        const existingPdfBytes = await fetch(fileUrl).then(res => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        const ranges = parsePageRanges(pageRange);
        if (ranges.length === 0 || ranges.some(range => range.start > pdfDoc.getPageCount())) {
            alert("無効なページ範囲です");
            return;
        }

        for (const { start } of ranges) {
            const page = pdfDoc.getPage(start - 1);
            const { height } = page.getSize();
            const imgBytes = await imgFile.arrayBuffer();
            const img = await pdfDoc.embedPng(imgBytes);
            const imgDims = img.scale(imgSize.width / img.width);
            const x = imgPosition.x;
            const y = height - imgPosition.y - imgDims.height;

            page.drawImage(img, {
                x: x,
                y: y,
                width: imgDims.width,
                height: imgDims.height,
            });
        }

        const pdfBytes = await pdfDoc.save();
        const newFileUrl = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
        const newTabs = tabs.map(tab =>
            tab.id === currentTab ? { ...tab, pdfFile: newFileUrl } : tab
        );
        setTabs(newTabs);
        setImgFile(null);
        setIsInserting(false);
    };

    const handleDrag = (e, data) => {
        setImgPosition({ x: data.x, y: data.y });
    };

    const handleResize = (e, { size }) => {
        setImgSize(size);
    };

    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            {sidebarOpen && (
                <div style={{ width: '200px', borderRight: '1px solid #ccc', padding: '10px', position: 'relative' }}>
                    <Typography variant="h6" align="center" gutterBottom>PDFくん</Typography>
                    <Button variant="contained" color="primary" onClick={() => inputRef.current.click()} fullWidth>PDFをアップロード</Button>
                    <Box height="10px" />
                    <Button variant="contained" color="primary" onClick={handleSavePdf} disabled={!tabs.length || !tabs[currentTab]?.pdfFile} fullWidth>名前をつけて保存</Button>
                    <Box height="20px" />
                    <Button variant="contained" color="primary" onClick={handleMergePdfs} disabled={tabs.filter(tab => tab.checked).length < 2} fullWidth>PDFを結合</Button>
                    <Box height="20px" />
                    <TextField
                        label="ページ指定"
                        value={pageRange}
                        onChange={(e) => setPageRange(e.target.value)}
                        InputLabelProps={{
                            shrink: true,
                        }}
                        placeholder="例: 2-4,6-8"
                        variant="outlined"
                        size="small"
                        fullWidth
                        margin="normal"
                    />
                    <Button variant="contained" color="primary" onClick={handleSplitPdf} disabled={!tabs.length || !tabs[currentTab]?.pdfFile} fullWidth>PDFを分割</Button>
                    <Box height="10px" />
                    <Button variant="contained" color="secondary" onClick={handleRemovePages} disabled={!tabs.length || !tabs[currentTab]?.pdfFile} fullWidth>ページ削除</Button>
                    <Box height="10px" />
                    <Button variant="contained" color="primary" onClick={() => imgInputRef.current.click()} disabled={!tabs.length || !tabs[currentTab]?.pdfFile} fullWidth>画像を挿入</Button>
                    <input
                        ref={imgInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                    />
                    {isInserting && (
                        <>
                            <Button variant="contained" color="primary" onClick={handleInsertImage} disabled={!imgFile} fullWidth>確定</Button>
                            <Button variant="contained" color="primary" onClick={() => { setIsDragging(true); setIsResizing(false); }} disabled={!imgFile} fullWidth>ドラッグ＆ドロップ</Button>
                            <Button variant="contained" color="primary" onClick={() => { setIsResizing(true); setIsDragging(false); }} disabled={!imgFile} fullWidth>リサイズ</Button>
                        </>
                    )}
                    <IconButton
                        onClick={() => setSidebarOpen(false)}
                        style={{ position: 'absolute', top: '50%', right: '-20px', transform: 'translateY(-50%)', zIndex: 3 }}
                    >
                        <ChevronLeft />
                    </IconButton>
                </div>
            )}
            {!sidebarOpen && (
                <IconButton
                    onClick={() => setSidebarOpen(true)}
                    style={{ position: 'absolute', top: '50%', left: '0', transform: 'translateY(-50%)', zIndex: 3 }}
                >
                    <ChevronRight />
                </IconButton>
            )}
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <TabContext value={currentTab.toString()}>
                    <Tabs value={currentTab.toString()} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
                        {tabs.map((tab, index) => (
                            <Tab
                                key={tab.id}
                                label={
                                    <Box display="flex" alignItems="center">
                                        <Checkbox
                                            checked={tab.checked}
                                            onChange={() => handleCheckTab(tab.id)}
                                            color="primary"
                                        />
                                        <Typography style={{ fontSize: '0.8rem' }}>{`PDF ${index + 1}`}</Typography>
                                        <IconButton size="small" onClick={() => handleRemoveTab(tab.id)}><Close fontSize="small" /></IconButton>
                                    </Box>
                                }
                                value={tab.id.toString()}
                                style={{ minHeight: 0, height: '48px' }}
                            />
                        ))}
                        <Tab
                            icon={<Add />}
                            onClick={handleAddTab}
                            style={{ minHeight: 0, height: '48px' }}
                        />
                    </Tabs>
                    {tabs.map((tab, index) => (
                        <TabPanel value={tab.id.toString()} key={tab.id} style={{ flexGrow: 1, padding: 0 }}>
                            {tab.pdfFile ? (
                                <div style={{ height: '750px', position: 'relative' }}>
                                    <Worker workerUrl={pdfjsWorker}>
                                        <Viewer
                                            fileUrl={tab.pdfFile}
                                            plugins={[defaultLayoutPluginInstance]}
                                        />
                                    </Worker>
                                    {imgFile && isInserting && (
                                        <Draggable
                                            disabled={!isDragging}
                                            position={imgPosition}
                                            onStop={handleDrag}
                                        >
                                            <ResizableBox
                                                width={imgSize.width}
                                                height={imgSize.height}
                                                resizeHandles={['se']}
                                                style={{ border: '1px solid black', position: 'absolute', top: imgPosition.y, left: imgPosition.x }}
                                                onResizeStop={handleResize}
                                                axis={isResizing ? 'both' : 'none'}
                                            >
                                                <img
                                                    src={URL.createObjectURL(imgFile)}
                                                    alt="drag"
                                                    style={{ width: '100%', height: '100%' }}
                                                />
                                            </ResizableBox>
                                        </Draggable>
                                    )}
                                </div>
                            ) : (
                                <input
                                    ref={inputRef}
                                    type="file"
                                    onChange={(e) => handleFileChange(e, tab.id)}
                                    style={{ display: 'none' }}
                                />
                            )}
                        </TabPanel>
                    ))}
                </TabContext>
            </div>
            <Dialog open={open} onClose={() => setOpen(false)}>
                <DialogTitle>名前をつけてPDFを保存</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="ファイル名"
                        fullWidth
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)} color="primary">キャンセル</Button>
                    <Button onClick={handleSave} color="primary">保存</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default App;
