import "@pixi/math-extras";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";

// TODO: add piece rotation
// TODO: add piece flipping
// TODO: do not dorp piece if overlaps
// TODO?: add piece ball connectors
// TODO?: snap inside box only

const WORLD_SIZE = 2000;
const DENT_RADIUS = 13;
const BALL_PIECE_RADIUS = DENT_RADIUS * 1.125;
const REFLECTION_RADIUS = DENT_RADIUS / 7;
const BOARD_MAX_X = 11;
const BOARD_MAX_Y = 5;
const DIF = BALL_PIECE_RADIUS - DENT_RADIUS;
const BOARD_MARGIN = new PIXI.Point(
  DENT_RADIUS * 0.5 - DIF,
  DENT_RADIUS * 0.5 - DIF
);

let draggedPieceName: string | undefined;
let dragTouchOffset: PIXI.Point;
const pieces = {} as Record<string, PIXI.Container>;

const yDoc = new Y.Doc();
const globalState = yDoc.getMap<any>("global");
globalState.set("maxZIndex", 100);
const piecesState = yDoc.getMap<Y.Map<any>>("piecesState");

main();

function main() {
  const docId = `packing-puzzle/${window.location.hash}`;
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
    }
  });

  const board = puzzleBox.addChild(new PIXI.Container());
  board.sortableChildren = true;
  board.position = BOARD_MARGIN;

  addPiece(board, "pink", gridToWorld(0, 0));
  addBallToPiece("pink", "#e66ba2", 0, 0);
  addBallToPiece("pink", "#e66ba2", 0, 0);
  addBallToPiece("pink", "#e66ba2", 1, 0);
  addBallToPiece("pink", "#e66ba2", 2, 0);
  addBallToPiece("pink", "#e66ba2", 2, 1);
  addBallToPiece("pink", "#e66ba2", 3, 1);

  addPiece(board, "teal", gridToWorld(0, 1));
  addBallToPiece("teal", "#83c2b9", 0, 0);
  addBallToPiece("teal", "#83c2b9", 0, 1);
  addBallToPiece("teal", "#83c2b9", 1, 0);
  addBallToPiece("teal", "#83c2b9", 1, 1);
  addBallToPiece("teal", "#83c2b9", 1, 2);

  addPiece(board, "lGreen", gridToWorld(0, 3));
  addBallToPiece("lGreen", "#8eb71d", 0, 0);
  addBallToPiece("lGreen", "#8eb71d", 0, 1);
  addBallToPiece("lGreen", "#8eb71d", 1, 1);
  addBallToPiece("lGreen", "#8eb71d", 2, 1);
  addBallToPiece("lGreen", "#8eb71d", 2, 0);

  addPiece(board, "maroon", gridToWorld(3, 3));
  addBallToPiece("maroon", "#aa201e", 0, 1);
  addBallToPiece("maroon", "#aa201e", 1, 1);
  addBallToPiece("maroon", "#aa201e", 1, 0);
  addBallToPiece("maroon", "#aa201e", 2, 0);

  addPiece(board, "orange", gridToWorld(2, 1));
  addBallToPiece("orange", "#e78a00", 0, 1);
  addBallToPiece("orange", "#e78a00", 1, 1);
  addBallToPiece("orange", "#e78a00", 2, 1);
  addBallToPiece("orange", "#e78a00", 2, 0);
  addBallToPiece("orange", "#e78a00", 1, 2);

  addPiece(board, "dGreen", gridToWorld(5, 3));
  addBallToPiece("dGreen", "#008455", 0, 1);
  addBallToPiece("dGreen", "#008455", 1, 1);
  addBallToPiece("dGreen", "#008455", 2, 1);
  addBallToPiece("dGreen", "#008455", 1, 0);

  addPiece(board, "purple", gridToWorld(6, 2));
  addBallToPiece("purple", "#7b1d7b", 0, 0);
  addBallToPiece("purple", "#7b1d7b", 1, 0);
  addBallToPiece("purple", "#7b1d7b", 1, 1);
  addBallToPiece("purple", "#7b1d7b", 2, 1);
  addBallToPiece("purple", "#7b1d7b", 2, 2);

  addPiece(board, "darkBlue", gridToWorld(8, 2));
  addBallToPiece("darkBlue", "#143d8c", 0, 0);
  addBallToPiece("darkBlue", "#143d8c", 1, 0);
  addBallToPiece("darkBlue", "#143d8c", 1, 1);
  addBallToPiece("darkBlue", "#143d8c", 1, 2);

  addPiece(board, "red", gridToWorld(9, 1));
  addBallToPiece("red", "#d30710", 0, 0);
  addBallToPiece("red", "#d30710", 1, 0);
  addBallToPiece("red", "#d30710", 1, 1);
  addBallToPiece("red", "#d30710", 1, 2);
  addBallToPiece("red", "#d30710", 1, 3);

  addPiece(board, "yellow", gridToWorld(7, 0));
  addBallToPiece("yellow", "#f5d100", 0, 0);
  addBallToPiece("yellow", "#f5d100", 1, 0);
  addBallToPiece("yellow", "#f5d100", 2, 0);
  addBallToPiece("yellow", "#f5d100", 3, 0);
  addBallToPiece("yellow", "#f5d100", 1, 1);

  addPiece(board, "blue", gridToWorld(3, 0));
  addBallToPiece("blue", "#0094d4", 0, 0);
  addBallToPiece("blue", "#0094d4", 1, 0);
  addBallToPiece("blue", "#0094d4", 2, 0);
  addBallToPiece("blue", "#0094d4", 2, 1);
  addBallToPiece("blue", "#0094d4", 2, 2);

  addPiece(board, "lBlue", gridToWorld(6, 0));
  addBallToPiece("lBlue", "#98ceea", 0, 0);
  addBallToPiece("lBlue", "#98ceea", 0, 1);
  addBallToPiece("lBlue", "#98ceea", 1, 1);
}

function onPieceDragStart(this: string, event: PIXI.FederatedPointerEvent) {
  event.stopPropagation();

  const pieceState = piecesState.get(this)!;
  if (pieceState.get("dragged")) {
    return;
  }
  draggedPieceName = this;

  const maxZIndex = globalState.get("maxZIndex") + 1;
  globalState.set("maxZIndex", maxZIndex);

  pieceState.set("dragged", true);
  pieceState.set("zIndex", maxZIndex);

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

function addPiece(
  container: PIXI.Container,
  pieceName: string,
  pos: PIXI.Point
) {
  pieces[pieceName] = container.addChild(new PIXI.Container());
  pieces[pieceName].position = pos;
  piecesState.set(
    pieceName,
    new Y.Map([
      ["x", pos.x],
      ["y", pos.y],
    ])
  );
}

function addBallToPiece(
  pieceName: string,
  color: PIXI.ColorSource,
  x: number,
  y: number
) {
  const ball = pieces[pieceName].addChild(
    new PIXI.Graphics()
      .beginFill(color)
      .drawCircle(BALL_PIECE_RADIUS, BALL_PIECE_RADIUS, BALL_PIECE_RADIUS)
  );
  ball.eventMode = "static";
  ball.cursor = "pointer";
  ball.position = gridToWorld(x, y);
  ball.on("pointerdown", onPieceDragStart, pieceName);

  const reflection = ball.addChild(
    new PIXI.Graphics()
      .beginFill("white")
      .drawCircle(REFLECTION_RADIUS, REFLECTION_RADIUS, REFLECTION_RADIUS)
  );
  reflection.position.set(DENT_RADIUS * 0.8, DENT_RADIUS * 0.8);
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
