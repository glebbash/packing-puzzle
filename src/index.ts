import "@pixi/math-extras";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";

// TODO?: do not drop piece if overlaps
// TODO?: improve flip/rotation UX
// TODO?: add piece ball connectors
// TODO?: snap inside box only

const WORLD_SIZE = 2000;
const DENT_RADIUS = 13;
const PART_RADIUS = DENT_RADIUS * 1.125;
const REFLECTION_RADIUS = DENT_RADIUS / 7;
const BOARD_MAX_X = 11;
const BOARD_MAX_Y = 5;
const BOARD_MARGIN = DENT_RADIUS * 1.5 - PART_RADIUS;
const DROP_TO_ROTATE_POS = gridToWorld(0, -2);
const DROP_TO_FLIP_POS = gridToWorld(10, -2);

let draggedPiece: Piece | undefined;
let dragTouchOffset: PIXI.Point;
const pieces = {} as Record<string, Piece>;

const yDoc = new Y.Doc();
const remotePieces = yDoc.getMap<Y.Map<any>>("piecesState");

setTimeout(main, 0);

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
      .beginFill("#1a1a1a")
      .drawRoundedRect(
        0,
        0,
        BOARD_MAX_X * DENT_RADIUS * 2.5 + DENT_RADIUS * 0.5 + PART_RADIUS * 1.6,
        BOARD_MAX_Y * DENT_RADIUS * 2.5 + DENT_RADIUS * 0.5 + PART_RADIUS * 1.6,
        DENT_RADIUS * 1.4
      )
  );
  puzzleBox.position.set(
    app.screen.width / 2 - puzzleBox.width / 2,
    app.screen.height / 2 - puzzleBox.height / 2
  );

  const puzzleBoxBottom = puzzleBox.addChild(
    new PIXI.Graphics()
      .beginFill("#292929")
      .drawRoundedRect(
        0,
        0,
        BOARD_MAX_X * DENT_RADIUS * 2.5 + DENT_RADIUS * 0.5,
        BOARD_MAX_Y * DENT_RADIUS * 2.5 + DENT_RADIUS * 0.5,
        DENT_RADIUS * 0.8
      )
      .setTransform(PART_RADIUS * 0.8, PART_RADIUS * 0.8)
  );

  for (let x = 0; x < BOARD_MAX_X; x++) {
    for (let y = 0; y < BOARD_MAX_Y; y++) {
      const pos = gridToWorld(x, y);
      puzzleBoxBottom
        .addChild(
          new PIXI.Graphics()
            .beginFill("black")
            .drawCircle(DENT_RADIUS, DENT_RADIUS, DENT_RADIUS)
            .setTransform(DENT_RADIUS * 0.5 + pos.x, DENT_RADIUS * 0.5 + pos.y)
        )
        .addChild(
          new PIXI.Graphics()
            .beginFill("white")
            .drawCircle(REFLECTION_RADIUS, REFLECTION_RADIUS, REFLECTION_RADIUS)
            .setTransform(DENT_RADIUS * 1.125, DENT_RADIUS * 1.125)
        );
    }
  }

  const board = puzzleBoxBottom.addChild(new PIXI.Container());
  board.sortableChildren = true;
  board.position.x = BOARD_MARGIN;
  board.position.y = BOARD_MARGIN;

  // rotate
  board
    .addChild(
      new PIXI.Graphics()
        .beginFill("black", 0.4)
        .drawCircle(DENT_RADIUS, DENT_RADIUS, DENT_RADIUS)
        .setTransform(DROP_TO_ROTATE_POS.x, DROP_TO_ROTATE_POS.y)
    )
    .addChild(
      new PIXI.Graphics()
        .beginFill("white", 0.4)
        .drawCircle(REFLECTION_RADIUS, REFLECTION_RADIUS, REFLECTION_RADIUS)
        .setTransform(DENT_RADIUS * 1.125, DENT_RADIUS * 1.125)
    );

  // flip
  board
    .addChild(
      new PIXI.Graphics()
        .beginFill("black", 0.4)
        .drawCircle(DENT_RADIUS, DENT_RADIUS, DENT_RADIUS)
        .setTransform(DROP_TO_FLIP_POS.x, DROP_TO_FLIP_POS.y)
    )
    .addChild(
      new PIXI.Graphics()
        .beginFill("white", 0.4)
        .drawCircle(REFLECTION_RADIUS, REFLECTION_RADIUS, REFLECTION_RADIUS)
        .setTransform(DENT_RADIUS * 1.125, DENT_RADIUS * 1.125)
    );

  board.addChild(
    new Piece("pink", "#e66ba2", -3, 6, [
      [1, 1, 1, 0],
      [0, 0, 1, 1],
    ]),
    new Piece("teal", "#83c2b9", -3, -4, [
      [1, 1],
      [1, 1],
      [0, 1],
    ]),
    new Piece("lGreen", "#8eb71d", 2, 6, [
      [1, 0, 1],
      [1, 1, 1],
    ]),
    new Piece("maroon", "#aa201e", 11, 6, [
      [0, 1, 1],
      [1, 1, 0],
    ]),
    new Piece("orange", "#e78a00", 12, -1, [
      [0, 0, 1],
      [1, 1, 1],
      [0, 1, 0],
    ]),
    new Piece("dGreen", "#008455", 12, 3, [
      [0, 1, 0],
      [1, 1, 1],
    ]),
    new Piece("purple", "#7b1d7b", 0, -4, [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ]),
    new Piece("darkBlue", "#143d8c", 4, -4, [
      [1, 1],
      [0, 1],
      [0, 1],
    ]),
    new Piece("red", "#d30710", -3, 0, [
      [1, 1],
      [0, 1],
      [0, 1],
      [0, 1],
    ]),
    new Piece("yellow", "#f5d100", 6, 6, [
      [1, 1, 1, 1],
      [0, 1, 0, 0],
    ]),
    new Piece("blue", "#0094d4", 7, -4, [
      [1, 1, 1],
      [0, 0, 1],
      [0, 0, 1],
    ]),
    new Piece("lBlue", "#98ceea", 11, -3, [
      [1, 0],
      [1, 1],
    ])
  );

  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  app.stage.on("pointermove", onPieceDragMove);
  app.stage.on("pointerup", onPieceDragEnd);
  app.stage.on("pointerupoutside", onPieceDragEnd);

  remotePieces.observeDeep(() => {
    for (const [pieceName, pieceState] of remotePieces) {
      pieces[pieceName].updateState(pieceState);
    }
  });
}

function onPieceDragStart(this: Piece, event: PIXI.FederatedPointerEvent) {
  event.stopPropagation();

  draggedPiece = this;
  draggedPiece.setDragged(true);
  dragTouchOffset = draggedPiece.position.subtract(
    draggedPiece.parent.toLocal(event.global)
  );
}

function onPieceDragMove(event: PIXI.FederatedPointerEvent) {
  if (!draggedPiece) return;

  draggedPiece.setPosition(
    draggedPiece.parent.toLocal(event.global).add(dragTouchOffset)
  );
}

function onPieceDragEnd() {
  if (!draggedPiece) return;

  const gridPos = worldToGrid(draggedPiece.position);
  draggedPiece.setPosition(gridToWorld(gridPos.x, gridPos.y));
  draggedPiece.setDragged(false);
  if (draggedPiece.overlapsWith(DROP_TO_ROTATE_POS)) {
    draggedPiece.rotate();
  }
  if (draggedPiece.overlapsWith(DROP_TO_FLIP_POS)) {
    draggedPiece.flip();
  }
  draggedPiece = undefined;
}

class Piece extends PIXI.Container {
  private remote?: Y.Map<any>;
  private rotations = 0;
  private flipped = false;
  private transformedParts = this.parts;

  constructor(
    private pieceName: string,
    private color: PIXI.ColorSource,
    gridX: number,
    gridY: number,
    private parts: (0 | 1)[][]
  ) {
    super();
    pieces[pieceName] = this;

    this.rebuildParts();
    this.position = gridToWorld(gridX, gridY);

    this.remote = new Y.Map<any>([
      ["x", this.position.x],
      ["y", this.position.y],
      ["dragged", false],
      ["flipped", false],
      ["rotations", 0],
    ]);
    remotePieces.set(this.pieceName, this.remote);
  }

  updateState(remote: Y.Map<any>) {
    this.remote = undefined;
    this.setPosition(new PIXI.Point(remote.get("x"), remote.get("y")));
    this.setDragged(remote.get("dragged") ?? false);
    this.setFlipped(remote.get("flipped") ?? false);
    this.setRotations(remote.get("rotations") ?? 0);
    this.remote = remote;
  }

  overlapsWith(pos: PIXI.Point) {
    for (const child of this.children) {
      if (child.position.add(this.position).equals(pos)) {
        return true;
      }
    }
    return false;
  }

  setPosition(pos: PIXI.Point) {
    if (this.remote) {
      this.remote.set("x", pos.x);
      this.remote.set("y", pos.y);
    }
    this.position = pos;
  }

  flip() {
    this.setFlipped(!this.flipped);
  }
  setFlipped(flipped: boolean) {
    if (this.flipped === flipped) {
      return;
    }
    if (this.remote) {
      this.remote.set("flipped", flipped);
    }

    this.flipped = flipped;
    this.transformedParts = transformMatrix(
      this.parts,
      this.rotations,
      this.flipped
    );
    this.rebuildParts();
  }

  rotate() {
    this.setRotations(this.rotations + 1);
  }
  setRotations(rotations: number) {
    rotations = rotations % 4;

    if (this.rotations === rotations) {
      return;
    }
    if (this.remote) {
      this.remote.set("rotations", rotations);
    }

    this.rotations = rotations;
    this.transformedParts = transformMatrix(
      this.parts,
      this.rotations,
      this.flipped
    );
    this.rebuildParts();
  }

  setDragged(dragged: boolean) {
    if (this.remote) {
      this.remote.set("dragged", dragged);
    }

    if (dragged) {
      this.alpha = 0.4;
      this.zIndex = Date.now();
    } else {
      this.alpha = 1;
    }
  }

  private rebuildParts() {
    this.removeChildren().forEach((c) => c.destroy());

    for (let y = 0; y < this.transformedParts.length; y++) {
      for (let x = 0; x < this.transformedParts[y].length; x++) {
        if (this.transformedParts[y][x] === 0) continue;

        this.buildPart(x, y);
      }
    }
  }

  private buildPart(x: number, y: number) {
    const part = this.addChild(
      new PIXI.Graphics()
        .beginFill(this.color)
        .drawCircle(PART_RADIUS, PART_RADIUS, PART_RADIUS)
    );
    part.eventMode = "static";
    part.cursor = "pointer";
    part.position = gridToWorld(x, y);
    part.on("pointerdown", onPieceDragStart, this);

    part.addChild(
      new PIXI.Graphics()
        .beginFill("white")
        .drawCircle(REFLECTION_RADIUS, REFLECTION_RADIUS, REFLECTION_RADIUS)
        .setTransform(DENT_RADIUS * 0.8, DENT_RADIUS * 0.8)
    );
  }
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

function transformMatrix<T>(matrix: T[][], rotations: number, flip: boolean) {
  for (let i = 0; i < rotations; i++) {
    matrix = matrix[0].map((_, index) =>
      matrix.map((row) => row[index]).reverse()
    );
  }
  if (flip) {
    matrix = matrix.slice(0).reverse();
  }
  return matrix;
}
