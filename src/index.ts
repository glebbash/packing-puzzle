import "@pixi/math-extras";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";

// TODO: add piece rotation
// TODO: add piece flipping
// TODO: add yjs rooms + local storage
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

let maxZIndex = 100;
let dragTarget: PIXI.Container | undefined;
let dragTouchOffset: PIXI.Point;

main();

function main() {
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
  app.stage.on("pointermove", (event) => {
    if (!dragTarget) return;

    dragTarget.position = dragTarget.parent
      .toLocal(event.global)
      .add(dragTouchOffset);
  });
  app.stage.on("pointerup", onDragEnd);
  app.stage.on("pointerupoutside", onDragEnd);
  function onDragEnd() {
    if (!dragTarget) return;

    dragTarget.alpha = 1;
    const gridPos = worldToGrid(dragTarget.position);
    dragTarget.position = gridToWorld(gridPos.x, gridPos.y);
    dragTarget = undefined;
  }

  const board = puzzleBox.addChild(new PIXI.Container());
  board.sortableChildren = true;
  board.position = BOARD_MARGIN;

  const magentaPiece = board.addChild(new PIXI.Container());
  magentaPiece.addChild(makeBall("#e66ba2")).position = gridToWorld(0, 0);
  magentaPiece.addChild(makeBall("#e66ba2")).position = gridToWorld(1, 0);
  magentaPiece.addChild(makeBall("#e66ba2")).position = gridToWorld(2, 0);
  magentaPiece.addChild(makeBall("#e66ba2")).position = gridToWorld(2, 1);
  magentaPiece.addChild(makeBall("#e66ba2")).position = gridToWorld(3, 1);
  magentaPiece.position = gridToWorld(0, 0);

  const tealPiece = board.addChild(new PIXI.Container());
  tealPiece.addChild(makeBall("#83c2b9")).position = gridToWorld(0, 0);
  tealPiece.addChild(makeBall("#83c2b9")).position = gridToWorld(0, 1);
  tealPiece.addChild(makeBall("#83c2b9")).position = gridToWorld(1, 0);
  tealPiece.addChild(makeBall("#83c2b9")).position = gridToWorld(1, 1);
  tealPiece.addChild(makeBall("#83c2b9")).position = gridToWorld(1, 2);
  tealPiece.position = gridToWorld(0, 1);

  const lightGreenPiece = board.addChild(new PIXI.Container());
  lightGreenPiece.addChild(makeBall("#8eb71d")).position = gridToWorld(0, 0);
  lightGreenPiece.addChild(makeBall("#8eb71d")).position = gridToWorld(0, 1);
  lightGreenPiece.addChild(makeBall("#8eb71d")).position = gridToWorld(1, 1);
  lightGreenPiece.addChild(makeBall("#8eb71d")).position = gridToWorld(2, 1);
  lightGreenPiece.addChild(makeBall("#8eb71d")).position = gridToWorld(2, 0);
  lightGreenPiece.position = gridToWorld(0, 3);

  const maroonPiece = board.addChild(new PIXI.Container());
  maroonPiece.addChild(makeBall("#aa201e")).position = gridToWorld(0, 1);
  maroonPiece.addChild(makeBall("#aa201e")).position = gridToWorld(1, 1);
  maroonPiece.addChild(makeBall("#aa201e")).position = gridToWorld(1, 0);
  maroonPiece.addChild(makeBall("#aa201e")).position = gridToWorld(2, 0);
  maroonPiece.position = gridToWorld(3, 3);

  const orangePiece = board.addChild(new PIXI.Container());
  orangePiece.addChild(makeBall("#e78a00")).position = gridToWorld(0, 1);
  orangePiece.addChild(makeBall("#e78a00")).position = gridToWorld(1, 1);
  orangePiece.addChild(makeBall("#e78a00")).position = gridToWorld(2, 1);
  orangePiece.addChild(makeBall("#e78a00")).position = gridToWorld(2, 0);
  orangePiece.addChild(makeBall("#e78a00")).position = gridToWorld(1, 2);
  orangePiece.position = gridToWorld(2, 1);

  const darkGreenPiece = board.addChild(new PIXI.Container());
  darkGreenPiece.addChild(makeBall("#008455")).position = gridToWorld(0, 1);
  darkGreenPiece.addChild(makeBall("#008455")).position = gridToWorld(1, 1);
  darkGreenPiece.addChild(makeBall("#008455")).position = gridToWorld(2, 1);
  darkGreenPiece.addChild(makeBall("#008455")).position = gridToWorld(1, 0);
  darkGreenPiece.position = gridToWorld(5, 3);

  const purplePiece = board.addChild(new PIXI.Container());
  purplePiece.addChild(makeBall("#7b1d7b")).position = gridToWorld(0, 0);
  purplePiece.addChild(makeBall("#7b1d7b")).position = gridToWorld(1, 0);
  purplePiece.addChild(makeBall("#7b1d7b")).position = gridToWorld(1, 1);
  purplePiece.addChild(makeBall("#7b1d7b")).position = gridToWorld(2, 1);
  purplePiece.addChild(makeBall("#7b1d7b")).position = gridToWorld(2, 2);
  purplePiece.position = gridToWorld(6, 2);

  const darkBluePiece = board.addChild(new PIXI.Container());
  darkBluePiece.addChild(makeBall("#143d8c")).position = gridToWorld(0, 0);
  darkBluePiece.addChild(makeBall("#143d8c")).position = gridToWorld(1, 0);
  darkBluePiece.addChild(makeBall("#143d8c")).position = gridToWorld(1, 1);
  darkBluePiece.addChild(makeBall("#143d8c")).position = gridToWorld(1, 2);
  darkBluePiece.position = gridToWorld(8, 2);

  const redPiece = board.addChild(new PIXI.Container());
  redPiece.addChild(makeBall("#d30710")).position = gridToWorld(0, 0);
  redPiece.addChild(makeBall("#d30710")).position = gridToWorld(1, 0);
  redPiece.addChild(makeBall("#d30710")).position = gridToWorld(1, 1);
  redPiece.addChild(makeBall("#d30710")).position = gridToWorld(1, 2);
  redPiece.addChild(makeBall("#d30710")).position = gridToWorld(1, 3);
  redPiece.position = gridToWorld(9, 1);

  const yellowPiece = board.addChild(new PIXI.Container());
  yellowPiece.addChild(makeBall("#f5d100")).position = gridToWorld(0, 0);
  yellowPiece.addChild(makeBall("#f5d100")).position = gridToWorld(1, 0);
  yellowPiece.addChild(makeBall("#f5d100")).position = gridToWorld(2, 0);
  yellowPiece.addChild(makeBall("#f5d100")).position = gridToWorld(3, 0);
  yellowPiece.addChild(makeBall("#f5d100")).position = gridToWorld(1, 1);
  yellowPiece.position = gridToWorld(7, 0);

  const bluePiece = board.addChild(new PIXI.Container());
  bluePiece.addChild(makeBall("#0094d4")).position = gridToWorld(0, 0);
  bluePiece.addChild(makeBall("#0094d4")).position = gridToWorld(1, 0);
  bluePiece.addChild(makeBall("#0094d4")).position = gridToWorld(2, 0);
  bluePiece.addChild(makeBall("#0094d4")).position = gridToWorld(2, 1);
  bluePiece.addChild(makeBall("#0094d4")).position = gridToWorld(2, 2);
  bluePiece.position = gridToWorld(3, 0);

  const lightBluePiece = board.addChild(new PIXI.Container());
  lightBluePiece.addChild(makeBall("#98ceea")).position = gridToWorld(0, 0);
  lightBluePiece.addChild(makeBall("#98ceea")).position = gridToWorld(0, 1);
  lightBluePiece.addChild(makeBall("#98ceea")).position = gridToWorld(1, 1);
  lightBluePiece.position = gridToWorld(6, 0);
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

function makeBall(color: PIXI.ColorSource) {
  const ball = new PIXI.Graphics()
    .beginFill(color)
    .drawCircle(BALL_PIECE_RADIUS, BALL_PIECE_RADIUS, BALL_PIECE_RADIUS);
  ball.eventMode = "static";
  ball.cursor = "pointer";
  ball.on("pointerdown", (event) => {
    event.stopPropagation();
    dragTarget = ball.parent;
    maxZIndex += 1;
    dragTarget.zIndex = maxZIndex;
    dragTarget.alpha = 0.5;
    dragTouchOffset = dragTarget.position.subtract(
      dragTarget.parent.toLocal(event.global)
    );
  });

  const reflection = ball.addChild(
    new PIXI.Graphics()
      .beginFill("white")
      .drawCircle(REFLECTION_RADIUS, REFLECTION_RADIUS, REFLECTION_RADIUS)
  );
  reflection.position.set(DENT_RADIUS * 0.8, DENT_RADIUS * 0.8);

  return ball;
}
