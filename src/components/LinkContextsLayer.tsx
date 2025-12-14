import { useMemo } from 'react';
import { Link } from '../GraphManager';
import { LinkContextPopup } from './LinkContextPopup';

type Position = { x: number; y: number };

function rectsOverlap(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number }
) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function computeNonOverlappingPopupPositions(items: Array<{ id: string; position: Position }>) {
  const POPUP_WIDTH = 256;
  const POPUP_HEIGHT = 140;
  const POPUP_PADDING = 12;
  const ANCHOR_Y_OFFSET = 15; // matches LinkContextPopup translateY(-15px)

  const placed: Array<{
    id: string;
    position: Position;
    rect: { left: number; top: number; right: number; bottom: number };
  }> = [];
  const result: Record<string, Position> = {};

  const calcRect = (p: Position) => {
    const left = p.x - POPUP_WIDTH / 2;
    const bottom = p.y - ANCHOR_Y_OFFSET;
    const top = bottom - POPUP_HEIGHT;
    const right = left + POPUP_WIDTH;
    return { left, top, right, bottom };
  };

  const sorted = [...items].sort((a, b) => a.position.y - b.position.y);

  for (const item of sorted) {
    let position: Position = { ...item.position };
    let rect = calcRect(position);

    for (let attempts = 0; attempts < 12; attempts++) {
      const collision = placed.some(p => rectsOverlap(p.rect, rect));
      if (!collision) break;

      const nextY = position.y - (POPUP_HEIGHT + POPUP_PADDING);
      if (nextY - POPUP_HEIGHT - ANCHOR_Y_OFFSET < 10) {
        position = { x: position.x + POPUP_WIDTH + POPUP_PADDING, y: item.position.y };
      } else {
        position = { x: position.x, y: nextY };
      }

      rect = calcRect(position);
    }

    result[item.id] = position;
    placed.push({ id: item.id, position, rect });
  }

  return result;
}

export function LinkContextsLayer(props: {
  activeLinkIds: string[];
  positions: Record<string, Position>;
  getLinkById: (linkId: string) => Link | undefined;
  onCloseLinkId: (linkId: string) => void;
}) {
  const items = useMemo(() => {
    return props.activeLinkIds
      .map(id => ({ id, position: props.positions[id] }))
      .filter((x): x is { id: string; position: Position } => Boolean(x.position));
  }, [props.activeLinkIds, props.positions]);

  const adjusted = useMemo(() => computeNonOverlappingPopupPositions(items), [items]);

  return (
    <>
      {props.activeLinkIds.map(linkId => {
        const link = props.getLinkById(linkId);
        const position = adjusted[linkId] || props.positions[linkId];
        if (!link || !position) return null;

        return (
          <LinkContextPopup
            key={linkId}
            link={link}
            position={position}
            onClose={() => props.onCloseLinkId(linkId)}
          />
        );
      })}
    </>
  );
}
