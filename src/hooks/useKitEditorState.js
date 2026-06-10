import React from "react";
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export default function useKitEditorState({
  kitInstrumentIds,
  setKitInstrumentIds,
  savedPresets,
  setSavedPresets,
  modifiedPresetBase,
  setModifiedPresetBase,
  pendingRemoval,
  setPendingRemoval,
  pendingPresetChange,
  setPendingPresetChange,
  keepTracksWithNotesEnabled,
  showPresetChangeWarningEnabled,
  isKitEditorOpen,
  setIsKitEditorOpen,
  isSaveAsDialogOpen,
  setIsSaveAsDialogOpen,
  saveAsName,
  setSaveAsName,
  presetNameInlineDraft,
  setPresetNameInlineDraft,
  baseGrid,
  setBaseGridWithUndo,
  columns,
  setSelection,
  setLoopRule,
  kitOrderListRef,
  drumkitPresets,
  builtinPresetOrder,
  presetLabels,
  instrumentById,
  cell,
}) {
  const getPresetIds = React.useCallback(
    (presetName) => {
      if (drumkitPresets[presetName]) return drumkitPresets[presetName];
      const saved = savedPresets.find((p) => p.id === presetName);
      return saved?.ids || null;
    },
    [drumkitPresets, savedPresets]
  );

  const getPresetLabel = React.useCallback(
    (presetName) => {
      if (presetLabels[presetName]) return presetLabels[presetName];
      const saved = savedPresets.find((p) => p.id === presetName);
      return saved?.label || presetName;
    },
    [presetLabels, savedPresets]
  );

  const makeUniquePresetId = React.useCallback(
    (label) => {
      const slug = String(label)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      let base = slug || "preset";
      if (drumkitPresets[base]) base = `user-${base}`;
      const exists = (id) => !!drumkitPresets[id] || savedPresets.some((p) => p.id === id);
      let id = base;
      let n = 2;
      while (exists(id)) {
        id = `${base}-${n}`;
        n += 1;
      }
      return id;
    },
    [drumkitPresets, savedPresets]
  );

  const mergeMissingPresetTracks = React.useCallback((keptIds, targetIds) => {
    const next = [...keptIds];

    targetIds.forEach((targetId, targetIdx) => {
      if (next.includes(targetId)) return;

      let insertAt = -1;
      for (let i = targetIdx - 1; i >= 0; i--) {
        const prevId = targetIds[i];
        const idx = next.indexOf(prevId);
        if (idx !== -1) {
          insertAt = idx + 1;
          break;
        }
      }

      if (insertAt === -1) {
        for (let i = targetIdx + 1; i < targetIds.length; i++) {
          const nextId = targetIds[i];
          const idx = next.indexOf(nextId);
          if (idx !== -1) {
            insertAt = idx;
            break;
          }
        }
      }

      if (insertAt === -1) insertAt = next.length;
      next.splice(insertAt, 0, targetId);
    });

    return next;
  }, []);

  const allPresetIds = React.useMemo(
    () => [...builtinPresetOrder, ...savedPresets.map((p) => p.id)],
    [builtinPresetOrder, savedPresets]
  );

  const selectedPreset =
    allPresetIds.find((presetName) => {
      const ids = getPresetIds(presetName);
      return ids && arraysEqual(kitInstrumentIds, ids);
    }) || null;

  const clearSelectionAndLoop = React.useCallback(() => {
    setSelection(null);
    setLoopRule(null);
  }, [setSelection, setLoopRule]);

  const applyKitIds = React.useCallback(
    (nextIds) => {
      const deduped = [...new Set(nextIds)].filter((id) => instrumentById[id]);
      if (deduped.length === 0) return;
      setKitInstrumentIds(deduped);
      setPendingRemoval(null);
      setPendingPresetChange(null);
      clearSelectionAndLoop();
    },
    [instrumentById, setKitInstrumentIds, setPendingRemoval, setPendingPresetChange, clearSelectionAndLoop]
  );

  const applyManualKitIds = React.useCallback(
    (nextIds) => {
      setModifiedPresetBase(selectedPreset || modifiedPresetBase || null);
      applyKitIds(nextIds);
    },
    [applyKitIds, selectedPreset, modifiedPresetBase, setModifiedPresetBase]
  );

  const hasNotesOnTrack = React.useCallback(
    (instId) => (baseGrid[instId] || []).some((v) => v !== cell.OFF),
    [baseGrid, cell]
  );

  const computePresetTransition = React.useCallback(
    (presetName) => {
      const targetIds = getPresetIds(presetName);
      if (!targetIds) return null;

      const removedIds = kitInstrumentIds.filter((id) => !targetIds.includes(id));
      const removedWithNotes = removedIds.filter((id) => hasNotesOnTrack(id));
      const removedSet = new Set(
        kitInstrumentIds.filter(
          (id) => !targetIds.includes(id) && !removedWithNotes.includes(id)
        )
      );
      const keptIds = kitInstrumentIds.filter((id) => !removedSet.has(id));
      const mergedKeepNoted = mergeMissingPresetTracks(keptIds, targetIds);

      return { targetIds, removedWithNotes, mergedKeepNoted };
    },
    [kitInstrumentIds, hasNotesOnTrack, mergeMissingPresetTracks, getPresetIds]
  );

  const requestPresetChange = React.useCallback(
    (presetName) => {
      const transition = computePresetTransition(presetName);
      if (!transition) return;
      const { targetIds, removedWithNotes, mergedKeepNoted } = transition;

      if (removedWithNotes.length === 0) {
        setModifiedPresetBase(null);
        applyKitIds(targetIds);
        return;
      }

      if (showPresetChangeWarningEnabled) {
        setPendingPresetChange({ presetName, targetIds, removedWithNotes });
        return;
      }

      if (keepTracksWithNotesEnabled) {
        setModifiedPresetBase(presetName);
        applyKitIds(mergedKeepNoted);
        return;
      }

      setModifiedPresetBase(null);
      applyKitIds(targetIds);
    },
    [
      computePresetTransition,
      applyKitIds,
      showPresetChangeWarningEnabled,
      keepTracksWithNotesEnabled,
      setModifiedPresetBase,
      setPendingPresetChange,
    ]
  );

  const confirmPresetKeepNotedTracks = React.useCallback(() => {
    if (!pendingPresetChange) return;
    const removedSet = new Set(
      kitInstrumentIds.filter(
        (id) =>
          !pendingPresetChange.targetIds.includes(id) &&
          !pendingPresetChange.removedWithNotes.includes(id)
      )
    );
    const keptIds = kitInstrumentIds.filter((id) => !removedSet.has(id));
    const merged = mergeMissingPresetTracks(keptIds, pendingPresetChange.targetIds);

    setModifiedPresetBase(pendingPresetChange.presetName);
    applyKitIds(merged);
  }, [pendingPresetChange, kitInstrumentIds, applyKitIds, mergeMissingPresetTracks, setModifiedPresetBase]);

  const confirmPresetDeleteAnyway = React.useCallback(() => {
    if (!pendingPresetChange) return;
    setModifiedPresetBase(null);
    applyKitIds(pendingPresetChange.targetIds);
  }, [pendingPresetChange, applyKitIds, setModifiedPresetBase]);

  React.useEffect(() => {
    if (!pendingPresetChange) return;
    const onKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (keepTracksWithNotesEnabled) confirmPresetKeepNotedTracks();
        else confirmPresetDeleteAnyway();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setPendingPresetChange(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    pendingPresetChange,
    confirmPresetKeepNotedTracks,
    confirmPresetDeleteAnyway,
    keepTracksWithNotesEnabled,
    setPendingPresetChange,
  ]);

  React.useEffect(() => {
    if (!isKitEditorOpen) return;
    if (pendingPresetChange) return;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (isSaveAsDialogOpen) {
        setIsSaveAsDialogOpen(false);
        setSaveAsName("");
        return;
      }
      setIsKitEditorOpen(false);
      setPendingRemoval(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isKitEditorOpen,
    pendingPresetChange,
    isSaveAsDialogOpen,
    setIsSaveAsDialogOpen,
    setSaveAsName,
    setIsKitEditorOpen,
    setPendingRemoval,
  ]);

  const presetOrder = allPresetIds;
  const stepperPresetAnchor =
    selectedPreset ||
    (modifiedPresetBase && presetOrder.includes(modifiedPresetBase) ? modifiedPresetBase : presetOrder[0]);

  const stepPreset = React.useCallback(
    (delta) => {
      const i = presetOrder.indexOf(stepperPresetAnchor);
      if (i === -1) {
        const fallback = delta >= 0 ? builtinPresetOrder[0] : builtinPresetOrder[builtinPresetOrder.length - 1];
        requestPresetChange(fallback);
        return;
      }

      const dir = delta >= 0 ? 1 : -1;
      for (let step = 1; step <= presetOrder.length; step++) {
        const next = presetOrder[(i + dir * step + presetOrder.length) % presetOrder.length];
        if (!showPresetChangeWarningEnabled) {
          const transition = computePresetTransition(next);
          if (!transition) continue;
          const preview = transition.removedWithNotes.length > 0
            ? (keepTracksWithNotesEnabled ? transition.mergedKeepNoted : transition.targetIds)
            : transition.targetIds;
          if (arraysEqual(preview, kitInstrumentIds)) continue;
        }
        requestPresetChange(next);
        return;
      }
    },
    [
      stepperPresetAnchor,
      presetOrder,
      builtinPresetOrder,
      requestPresetChange,
      computePresetTransition,
      showPresetChangeWarningEnabled,
      keepTracksWithNotesEnabled,
      kitInstrumentIds,
    ]
  );

  const selectedPresetLabel =
    selectedPreset
      ? getPresetLabel(selectedPreset)
      : modifiedPresetBase
        ? `${getPresetLabel(modifiedPresetBase)}*`
        : "Modified";
  const selectedSavedPreset =
    selectedPreset ? savedPresets.find((p) => p.id === selectedPreset) || null : null;

  React.useEffect(() => {
    setPresetNameInlineDraft(selectedSavedPreset ? selectedSavedPreset.label : selectedPresetLabel);
  }, [selectedSavedPreset, selectedPresetLabel, setPresetNameInlineDraft]);

  const savePresetAsNew = React.useCallback(() => {
    const label = saveAsName.trim();
    if (!label) return;
    const id = makeUniquePresetId(label);
    setSavedPresets((prev) => [...prev, { id, label, ids: [...kitInstrumentIds] }]);
    setModifiedPresetBase(null);
    setSaveAsName("");
    setIsSaveAsDialogOpen(false);
  }, [
    saveAsName,
    makeUniquePresetId,
    kitInstrumentIds,
    setSavedPresets,
    setModifiedPresetBase,
    setSaveAsName,
    setIsSaveAsDialogOpen,
  ]);

  const renameSelectedPresetInline = React.useCallback(() => {
    if (!selectedSavedPreset) return;
    const label = presetNameInlineDraft.trim();
    if (!label) return;
    setSavedPresets((prev) =>
      prev.map((p) => (p.id === selectedSavedPreset.id ? { ...p, label } : p))
    );
  }, [selectedSavedPreset, presetNameInlineDraft, setSavedPresets]);

  const deleteSelectedPreset = React.useCallback(() => {
    if (!selectedSavedPreset) return;
    const deletingId = selectedSavedPreset.id;
    setSavedPresets((prev) => prev.filter((p) => p.id !== deletingId));
    if (modifiedPresetBase === deletingId) setModifiedPresetBase(null);
  }, [selectedSavedPreset, modifiedPresetBase, setSavedPresets, setModifiedPresetBase]);

  const requestRemoveInstrument = React.useCallback(
    (instId) => {
      if (!kitInstrumentIds.includes(instId)) return;
      if (!hasNotesOnTrack(instId)) {
        applyManualKitIds(kitInstrumentIds.filter((id) => id !== instId));
        return;
      }
      const moveTargetId = kitInstrumentIds.find((id) => id !== instId) || null;
      setPendingRemoval({ instId, moveTargetId });
    },
    [kitInstrumentIds, hasNotesOnTrack, applyManualKitIds, setPendingRemoval]
  );

  const confirmRemoveDeleteNotes = React.useCallback(() => {
    if (!pendingRemoval?.instId) return;
    const instId = pendingRemoval.instId;
    setBaseGridWithUndo((prev) => ({
      ...prev,
      [instId]: Array(columns).fill(cell.OFF),
    }));
    applyManualKitIds(kitInstrumentIds.filter((id) => id !== instId));
  }, [pendingRemoval, columns, cell, setBaseGridWithUndo, applyManualKitIds, kitInstrumentIds]);

  const confirmRemoveMoveNotes = React.useCallback(() => {
    if (!pendingRemoval?.instId || !pendingRemoval?.moveTargetId) return;
    const srcId = pendingRemoval.instId;
    const dstId = pendingRemoval.moveTargetId;
    if (srcId === dstId) return;

    setBaseGridWithUndo((prev) => {
      const next = { ...prev };
      const src = [...(prev[srcId] || Array(columns).fill(cell.OFF))];
      const dst = [...(prev[dstId] || Array(columns).fill(cell.OFF))];
      const rank = (v) => (v === cell.ACCENT ? 3 : v === cell.ON ? 2 : v === cell.GHOST ? 1 : 0);
      for (let c = 0; c < columns; c++) {
        const from = src[c] ?? cell.OFF;
        if (from === cell.OFF) continue;
        const to = dst[c] ?? cell.OFF;
        dst[c] = rank(from) >= rank(to) ? from : to;
        src[c] = cell.OFF;
      }
      next[srcId] = src;
      next[dstId] = dst;
      return next;
    });

    applyManualKitIds(kitInstrumentIds.filter((id) => id !== srcId));
  }, [pendingRemoval, setBaseGridWithUndo, columns, cell, applyManualKitIds, kitInstrumentIds]);

  const toggleInstrumentInKit = React.useCallback(
    (instId, enable) => {
      if (enable) {
        if (kitInstrumentIds.includes(instId)) return;
        const fullOrder = drumkitPresets.full;
        const newFullIdx = fullOrder.indexOf(instId);
        if (newFullIdx === -1) {
          applyManualKitIds([...kitInstrumentIds, instId]);
          return;
        }

        let insertAt = kitInstrumentIds.length;
        for (let i = newFullIdx + 1; i < fullOrder.length; i++) {
          const anchorId = fullOrder[i];
          const idx = kitInstrumentIds.indexOf(anchorId);
          if (idx !== -1) {
            insertAt = idx;
            break;
          }
        }

        if (insertAt === kitInstrumentIds.length) {
          for (let i = newFullIdx - 1; i >= 0; i--) {
            const anchorId = fullOrder[i];
            const idx = kitInstrumentIds.indexOf(anchorId);
            if (idx !== -1) {
              insertAt = idx + 1;
              break;
            }
          }
        }

        const next = [...kitInstrumentIds];
        next.splice(insertAt, 0, instId);
        applyManualKitIds(next);
        return;
      }
      requestRemoveInstrument(instId);
    },
    [kitInstrumentIds, drumkitPresets, applyManualKitIds, requestRemoveInstrument]
  );

  const kitOrderSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const onKitOrderDragEnd = React.useCallback(
    (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = kitInstrumentIds.indexOf(String(active.id));
      const newIndex = kitInstrumentIds.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      applyManualKitIds(arrayMove(kitInstrumentIds, oldIndex, newIndex));
    },
    [kitInstrumentIds, applyManualKitIds]
  );

  const restrictKitDragToList = React.useCallback(({ transform, activeNodeRect }) => {
    const listEl = kitOrderListRef.current;
    if (!listEl || !transform || !activeNodeRect) {
      return transform ? { ...transform, x: 0 } : transform;
    }
    const listRect = listEl.getBoundingClientRect();
    const minY = listRect.top - activeNodeRect.top;
    const maxY = listRect.bottom - activeNodeRect.bottom;
    return {
      ...transform,
      x: 0,
      y: Math.max(minY, Math.min(maxY, transform.y)),
    };
  }, [kitOrderListRef]);

  return {
    getPresetIds,
    getPresetLabel,
    allPresetIds,
    selectedPreset,
    selectedPresetLabel,
    selectedSavedPreset,
    applyKitIds,
    applyManualKitIds,
    requestPresetChange,
    confirmPresetKeepNotedTracks,
    confirmPresetDeleteAnyway,
    stepPreset,
    savePresetAsNew,
    renameSelectedPresetInline,
    deleteSelectedPreset,
    requestRemoveInstrument,
    confirmRemoveDeleteNotes,
    confirmRemoveMoveNotes,
    toggleInstrumentInKit,
    kitOrderSensors,
    onKitOrderDragEnd,
    restrictKitDragToList,
  };
}
