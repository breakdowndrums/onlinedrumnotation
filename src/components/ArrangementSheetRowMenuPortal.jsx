import React from "react";
import { createPortal } from "react-dom";

export default function ArrangementSheetRowMenuPortal({
  menuState,
  rows,
  RowMenuComponent,
  globalNotationBarsPerRow,
  globalNotationDynamicSpacing,
  globalMergeRests,
  globalMergeNotes,
  globalDottedNotes,
  globalNotationPrintStickingMode,
  getNotationPrintStickingModeFromPayload,
  onClose,
  onUpdateRowNotationOptions,
}) {
  if (!menuState) return null;

  const row = rows[menuState.rowIndex];
  if (!row) return null;

  const updateRow = (updates) => {
    onUpdateRowNotationOptions?.(row.id, updates);
  };

  return createPortal(
    <RowMenuComponent
      row={row}
      position={menuState.position}
      globalNotationBarsPerRow={globalNotationBarsPerRow}
      globalNotationDynamicSpacing={globalNotationDynamicSpacing}
      globalMergeRests={globalMergeRests}
      globalMergeNotes={globalMergeNotes}
      globalDottedNotes={globalDottedNotes}
      globalNotationPrintStickingMode={globalNotationPrintStickingMode}
      getNotationPrintStickingModeFromPayload={getNotationPrintStickingModeFromPayload}
      onClose={onClose}
      onToggleNotationBeatName={() =>
        updateRow({
          showNotationBeatName: !row.showNotationBeatName,
        })
      }
      onSetNotationDynamicSpacing={(value) =>
        updateRow({
          notationDynamicSpacing: value,
        })
      }
      onSetNotationSpacingPreset={(value) =>
        updateRow({
          notationSpacingPreset: value,
        })
      }
      onSetNotationCustomText={(text) =>
        updateRow({
          notationCustomText: text,
        })
      }
      onSetNotationBarsPerRowOverride={(value) =>
        updateRow({
          notationBarsPerRowOverride: value,
        })
      }
      onSetNotationMergeRests={(value) =>
        updateRow({
          notationMergeRests: value,
        })
      }
      onSetNotationMergeNotes={(value) =>
        updateRow({
          notationMergeNotes: value,
        })
      }
      onSetNotationDottedNotes={(value) =>
        updateRow({
          notationDottedNotes: value,
        })
      }
      onSetNotationPrintSticking={(value) =>
        updateRow({
          notationPrintSticking: value,
        })
      }
    />,
    document.body
  );
}
