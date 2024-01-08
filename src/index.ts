import "@pixi/math-extras";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";

// TODO: add piece rotation
// TODO: add piece flipping
// TODO: do not drop piece if overlaps
// TODO?: add piece ball connectors
// TODO?: snap inside box only

const WORLD_SIZE = 2000;
const DENT_RADIUS = 13;
const PART_RADIUS = DENT_RADIUS * 1.125;
const REFLECTION_RADIUS = DENT_RADIUS / 7;
const BOARD_MAX_X = 11;
const BOARD_MAX_Y = 5;
const BOARD_MARGIN = DENT_RADIUS * 1.5 - PART_RADIUS;

let draggedPieceName: string | undefined;
let dragTouchOffset: PIXI.Point;
const pieces = {} as Record<string, PIXI.Container>;

const yDoc = new Y.Doc();
const piecesState = yDoc.getMap<Y.Map<any>>("piecesState");

main();

function main() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("room") ?? crypto.randomUUID();
  const docId = `packing-puzzle/${roomId}`;
  new IndexeddbPersistence(docId, yDoc);
  new WebrtcProvider(docId, yDoc, {
    signaling: ["wss://yjs-signaling.deno.dev/"],
  });

  const app = new PIXI.Application({
    resizeTo: window,
    antialias: true,
    backgroundColor: "#38761d",
  });
  document.body.appendChild(app.view as never);

  const viewport = app.stage.addChild(
    new Viewport({
      screenWidth: app.screen.width,
      screenHeight: app.screen.height,
      worldWidth: WORLD_SIZE,
      worldHeight: WORLD_SIZE,
      events: app.renderer.events,
    })
      .drag()
      .pinch()
      .wheel()
  );
  window.addEventListener("resize", () => {
    viewport.resize(app.screen.width, app.screen.height);
  });

  const puzzleBox = viewport.addChild(
    new PIXI.Graphics()
      .beginFill("#292929")
      .drawRoundedRect(
        0,
        0,
        BOARD_MAX_X * DENT_RADIUS * 2.5 + DENT_RADIUS * 0.5,
        BOARD_MAX_Y * DENT_RADIUS * 2.5 + DENT_RADIUS * 0.5,
        DENT_RADIUS * 0.8
      )
  );
  puzzleBox.position.set(
    app.screen.width / 2 - puzzleBox.width / 2,
    app.screen.height / 2 - puzzleBox.height / 2
  );

  for (let x = 0; x < BOARD_MAX_X; x++) {
    for (let y = 0; y < BOARD_MAX_Y; y++) {
      const dent = puzzleBox.addChild(
        new PIXI.Graphics()
          .beginFill("black")
          .drawCircle(DENT_RADIUS, DENT_RADIUS, DENT_RADIUS)
      );
      dent.position = gridToWorld(x, y).add({
        x: DENT_RADIUS * 0.5,
        y: DENT_RADIUS * 0.5,
      });

      const reflection = dent.addChild(
        new PIXI.Graphics()
          .beginFill("white")
          .drawCircle(REFLECTION_RADIUS, REFLECTION_RADIUS, REFLECTION_RADIUS)
      );
      reflection.position.set(DENT_RADIUS * 1.125, DENT_RADIUS * 1.125);
    }
  }

  const board = puzzleBox.addChild(new PIXI.Container());
  board.sortableChildren = true;
  board.position.x = BOARD_MARGIN;
  board.position.y = BOARD_MARGIN;

  board.addChild(
    makePiece("pink", "#e66ba2", -3, 6, [
      [1, 1, 1, 0],
      [0, 0, 1, 1],
    ]),
    makePiece("teal", "#83c2b9", -3, -4, [
      [1, 1],
      [1, 1],
      [0, 1],
    ]),
    makePiece("lGreen", "#8eb71d", 2, 6, [
      [1, 0, 1],
      [1, 1, 1],
    ]),
    makePiece("maroon", "#aa201e", 11, 6, [
      [0, 1, 1],
      [1, 1, 0],
    ]),
    makePiece("orange", "#e78a00", 12, -1, [
      [0, 0, 1],
      [1, 1, 1],
      [0, 1, 0],
    ]),
    makePiece("dGreen", "#008455", 12, 3, [
      [0, 1, 0],
      [1, 1, 1],
    ]),
    makePiece("purple", "#7b1d7b", 0, -4, [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ]),
    makePiece("darkBlue", "#143d8c", 4, -4, [
      [1, 1],
      [0, 1],
      [0, 1],
    ]),
    makePiece("red", "#d30710", -3, 0, [
      [1, 1],
      [0, 1],
      [0, 1],
      [0, 1],
    ]),
    makePiece("yellow", "#f5d100", 6, 6, [
      [1, 1, 1, 1],
      [0, 1, 0, 0],
    ]),
    makePiece("blue", "#0094d4", 7, -4, [
      [1, 1, 1],
      [0, 0, 1],
      [0, 0, 1],
    ]),
    makePiece("lBlue", "#0094d4", 11, -3, [
      [1, 1],
      [0, 1],
    ])
  );

  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  app.stage.on("pointermove", onPieceDragMove);
  app.stage.on("pointerup", onPieceDragEnd);
  app.stage.on("pointerupoutside", onPieceDragEnd);

  piecesState.observeDeep(() => {
    for (const [pieceName, pieceState] of piecesState) {
      const piece = pieces[pieceName];
      piece.position.set(pieceState.get("x"), pieceState.get("y"));
      piece.alpha = pieceState.get("dragged") ? 0.5 : 1;
      piece.zIndex = pieceState.get("zIndex");
    }
  });
}

function onPieceDragStart(this: string, event: PIXI.FederatedPointerEvent) {
  event.stopPropagation();

  const pieceState = piecesState.get(this)!;
  if (pieceState.get("dragged")) {
    return;
  }
  draggedPieceName = this;

  pieceState.set("dragged", true);
  pieceState.set("zIndex", Date.now());

  const dragTarget = pieces[draggedPieceName];
  dragTouchOffset = dragTarget.position.subtract(
    dragTarget.parent.toLocal(event.global)
  );
}

function onPieceDragMove(event: PIXI.FederatedPointerEvent) {
  if (!draggedPieceName) return;

  const newPos = pieces[draggedPieceName].parent
    .toLocal(event.global)
    .add(dragTouchOffset);

  const pieceState = piecesState.get(draggedPieceName)!;
  pieceState.set("x", newPos.x);
  pieceState.set("y", newPos.y);
}

function onPieceDragEnd() {
  if (!draggedPieceName) return;

  const gridPos = worldToGrid(pieces[draggedPieceName].position);
  const newPos = gridToWorld(gridPos.x, gridPos.y);
  const pieceState = piecesState.get(draggedPieceName)!;
  pieceState.set("dragged", false);
  pieceState.set("x", newPos.x);
  pieceState.set("y", newPos.y);

  draggedPieceName = undefined;
}

function makePiece(
  pieceName: string,
  color: PIXI.ColorSource,
  gridX: number,
  gridY: number,
  parts: (0 | 1)[][]
) {
  const piece = new PIXI.Container();
  piece.position = gridToWorld(gridX, gridY);
  piecesState.set(
    pieceName,
    new Y.Map([
      ["x", piece.position.x],
      ["y", piece.position.y],
    ])
  );

  for (let y = 0; y < parts.length; y++) {
    for (let x = 0; x < parts[y].length; x++) {
      if (parts[y][x] === 0) continue;

      const part = piece.addChild(
        new PIXI.Graphics()
          .beginFill(color)
          .drawCircle(PART_RADIUS, PART_RADIUS, PART_RADIUS)
      );
      part.eventMode = "static";
      part.cursor = "pointer";
      part.position = gridToWorld(x, y);
      part.on("pointerdown", onPieceDragStart, pieceName);

      const reflection = part.addChild(
        new PIXI.Graphics()
          .beginFill("white")
          .drawCircle(REFLECTION_RADIUS, REFLECTION_RADIUS, REFLECTION_RADIUS)
      );
      reflection.position.set(DENT_RADIUS * 0.8, DENT_RADIUS * 0.8);
    }
  }

  pieces[pieceName] = piece;
  return piece;
}

function gridToWorld(x: number, y: number) {
  return new PIXI.Point(DENT_RADIUS * 2.5 * x, DENT_RADIUS * 2.5 * y);
}

function worldToGrid(pos: PIXI.Point) {
  return new PIXI.Point(
    Math.round(pos.x / (DENT_RADIUS * 2.5)),
    Math.round(pos.y / (DENT_RADIUS * 2.5))
  );
}
