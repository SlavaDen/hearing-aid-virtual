import { useEffect, type CSSProperties } from "react";
import { bootstrapTryOn } from "./tryOnEngine.js";

const models = [
  { id: "contour", name: "Contour", detail: "Заушный · BTE" },
  { id: "silk", name: "Silk", detail: "Тонкий ресивер · RIC" },
  { id: "inside", name: "Inside", detail: "Внутриушной · ITE" },
] as const;

const colors = [
  ["#c7aa83", "Champagne"],
  ["#63564e", "Graphite"],
  ["#d9d5ce", "Pearl"],
  ["#1f2427", "Midnight"],
  ["#a77a68", "Rose"],
] as const;

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 10l4.5-2.5v9L15 14z" /><rect x="3" y="6" width="12" height="12" rx="3" />
    </svg>
  );
}

export default function App() {
  useEffect(() => {
    bootstrapTryOn();
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Auris home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40">
              <path d="M20 4a13 13 0 0 0-8.7 22.7c2.8 2.5 3.4 4.5 3.4 7.3" />
              <path d="M20 10a7.4 7.4 0 0 0-4.8 13c2 1.7 2.7 3.4 2.7 6.4" />
              <path d="M20 16c3.7 0 5.7 4.4 3 7.1-1.7 1.7-2.5 3.4-2.5 5.9" />
            </svg>
          </span>
          <span>AURIS</span>
        </a>
        <div className="prototype-badge"><span /> Live prototype</div>
        <button className="icon-button" id="helpButton" aria-label="Как пользоваться">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.35 2.35 0 1 1 3.4 2.1c-.85.45-1.2.95-1.2 1.9" /><path d="M12 17h.01" /></svg>
        </button>
      </header>

      <section className="hero-copy">
        <p className="eyebrow">See what feels like you</p>
        <h1>Примерьте незаметно.<br /><em>Выберите уверенно.</em></h1>
        <p className="intro">Посмотрите, как разные слуховые аппараты выглядят именно на вас — прямо в браузере.</p>
      </section>

      <section className="experience-grid" aria-label="Виртуальная примерка">
        <div className="stage-card">
          <div className="camera-stage" id="cameraStage">
            <video id="camera" playsInline muted />
            <img id="photoSource" alt="Загруженное фото для примерки" />
            <div id="threeLayer" aria-hidden="true" />
            <canvas id="debugLayer" aria-hidden="true" />

            <div className="empty-state" id="emptyState">
              <div className="ear-orbit" aria-hidden="true">
                <svg viewBox="0 0 120 120">
                  <path d="M64 24c-24 0-38 16-38 38 0 15 7 22 14 29 7 7 8 12 9 20" />
                  <path d="M65 41c-13 0-21 9-21 21 0 9 4 13 9 18 4 4 6 8 6 14" />
                  <path d="M66 55c8 0 12 9 7 15-4 4-6 8-6 14" />
                </svg>
              </div>
              <h2>Ваша примерочная готова</h2>
              <p>Камера обрабатывается только на устройстве.<br />Видео никуда не отправляется.</p>
              <div className="start-actions">
                <button className="primary-button" id="startButton"><CameraIcon />Включить камеру</button>
                <label className="text-button" htmlFor="photoInput">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l1.3-2h7.4L17 7h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                  Загрузить фото
                </label>
                <input id="photoInput" type="file" accept="image/*" hidden />
              </div>
            </div>

            <div className="stage-status" id="stageStatus" hidden>
              <span className="status-dot" /><span id="statusText">Ищем лицо…</span>
            </div>
            <div className="alignment-guide" id="alignmentGuide" hidden aria-hidden="true">
              <div /><span>Поверните голову немного в сторону</span>
            </div>
            <button className="stage-action" id="flipButton" hidden aria-label="Сменить камеру">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 8.1A8 8 0 0 1 19 12M5 12a8 8 0 0 0 12.9 3.9" /></svg>
            </button>
            <div className="privacy-chip">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3" /><rect x="4" y="10" width="16" height="11" rx="3" /></svg>
              On-device processing
            </div>
          </div>
        </div>

        <aside className="control-panel" aria-label="Настройки аппарата">
          <div className="panel-heading">
            <div><p className="step-label">Шаг 1 из 2</p><h2>Выберите стиль</h2></div>
            <button className="compact-button" id="debugButton" aria-pressed="false">Diagnostics</button>
          </div>

          <div className="model-list" role="radiogroup" aria-label="Модель слухового аппарата">
            {models.map((model, index) => (
              <button key={model.id} className={`model-card${index === 0 ? " active" : ""}`} data-model={model.id} role="radio" aria-checked={index === 0}>
                <span className={`model-visual ${model.id}-visual`} aria-hidden="true"><i />{model.id !== "inside" && <b />}</span>
                <span className="model-copy"><strong>{model.name}</strong><small>{model.detail}</small></span>
                <span className="checkmark">✓</span>
              </button>
            ))}
          </div>

          <div className="divider" />
          <div className="option-row">
            <div><p className="step-label">Шаг 2 из 2</p><h3>Цвет корпуса</h3></div>
            <span className="color-name" id="colorName">Champagne</span>
          </div>
          <div className="swatches" role="radiogroup" aria-label="Цвет корпуса">
            {colors.map(([color, name], index) => (
              <button
                key={color}
                className={`swatch${index === 0 ? " active" : ""}`}
                data-color={color}
                data-name={name}
                style={{ "--swatch": color } as CSSProperties}
                aria-label={name}
                aria-checked={index === 0}
                role="radio"
              />
            ))}
          </div>

          <div className="divider" />
          <div className="ear-control">
            <div><h3>Сторона</h3><p>Автовыбор следует за поворотом головы</p></div>
            <div className="segmented" role="group" aria-label="Выбор уха">
              <button data-ear="left">L</button><button data-ear="auto" className="active">Auto</button><button data-ear="right">R</button>
            </div>
          </div>

          <div className="fit-note">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 1.5" /></svg>
            <p><strong>Совет для точной посадки</strong><br />Держите лицо на расстоянии 50–80 см и медленно поворачивайте голову.</p>
          </div>
        </aside>
      </section>

      <footer>
        <span>Experimental virtual try-on · Not a medical fitting tool</span>
        <span>React + MediaPipe + Three.js · No video upload</span>
      </footer>

      <dialog id="helpDialog">
        <button className="dialog-close" id="closeHelp" aria-label="Закрыть">×</button>
        <p className="eyebrow">Короткая инструкция</p>
        <h2>Как получить лучший результат</h2>
        <ol>
          <li>Разрешите доступ к камере и расположитесь при ровном свете.</li>
          <li>Медленно поверните голову, чтобы одно ухо было хорошо видно.</li>
          <li>Выберите модель, цвет и при необходимости сторону вручную.</li>
        </ol>
        <p className="dialog-note">Это технический POC. Размер оценивается относительно ширины лица и не заменяет профессиональную примерку.</p>
      </dialog>
    </main>
  );
}
