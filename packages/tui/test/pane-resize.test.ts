import { expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { MouseButton } from "@opentui/core"
import { createPaneResize } from "../src/ui/pane-resize"

// 真实的拖拽生命周期测试：走 createPaneResize 的公开回调（与 SessionFrame 接线一致），
// 覆盖 onMouseDown → onMouseDrag → onMouseUp → onCommit 全链路。
test("dragging the pane divider commits a new width", async () => {
  const setup = await createTestRenderer({ width: 120, height: 20 })
  const committed: number[] = []
  const resize = createPaneResize({
    value: () => 30,
    defaultValue: () => 30,
    clamp: (width) => Math.max(20, Math.min(width, 44)),
    fromMouse: (event) => 120 - event.x - 1,
    contains: (event, width) => event.x >= 120 - width - 1 && event.x <= 120 - width,
    onCommit: (width) => committed.push(width),
  })

  const event = (x: number) => ({ x, y: 5, button: MouseButton.LEFT, stopPropagation() {}, preventDefault() {} }) as any

  resize.onMouseDown(event(89))     // 边界：120 - 30 - 1
  expect(resize.resizing()).toBe(true)
  resize.onMouseDrag(event(70))     // 向左拖 → 变宽
  resize.onMouseUp(event(70))
  expect(resize.resizing()).toBe(false)
  expect(committed.length).toBe(1)
  expect(committed[0]).toBeGreaterThan(30)
  expect(committed[0]).toBeLessThanOrEqual(44)

  await setup.renderer.destroy()
})

test("clamp keeps the pane inside its bounds", async () => {
  const setup = await createTestRenderer({ width: 120, height: 20 })
  for (const width of [1, 200]) {
    const resize = createPaneResize({
      value: () => 30,
      defaultValue: () => 30,
      clamp: (value) => Math.max(20, Math.min(value, 44)),
      fromMouse: () => width,
      contains: () => true,
      onCommit: () => {},
    })
    expect(resize.size()).toBeGreaterThanOrEqual(20)
    expect(resize.size()).toBeLessThanOrEqual(44)
  }
  await setup.renderer.destroy()
})
