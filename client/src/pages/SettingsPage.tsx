import { useState } from 'react';
import { Code2, Lightbulb, ShieldCheck, Sparkles, Sun, Trash2 } from 'lucide-react';
import { Button, Pill } from '../components/ui';
import { useSettings } from '../settings/SettingsContext';
import { useToast } from '../hooks/useToast';
import { clearCodeMentorData } from '../storage/localStorage';
import {
  isLanguageAvailable,
  languageOptionLabel,
  languageNames,
} from '../data/languages';
import type { ExplanationLevel, HintLevel, ThemePreference } from '../settings/defaults';
import type { LanguageName } from '../types';

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      className={`switch ${on ? 'on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
    >
      <i />
    </button>
  );
}

export function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const { notify } = useToast();
  const [confirming, setConfirming] = useState(false);

  const clearData = () => {
    clearCodeMentorData();
    reset();
    setConfirming(false);
    notify('Local learning data cleared from this browser.', 'info');
  };

  return (
    <div className="content-page settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR PREFERENCES</span>
          <h1>Settings</h1>
          <p>Make CodeMentor AI feel like your own learning space.</p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-card card">
          <div className="setting-title">
            <div className="setting-icon">
              <Sun size={18} />
            </div>
            <div>
              <h2>Appearance</h2>
              <p>Choose how CodeMentor AI looks and feels.</p>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Theme</strong>
              <span>Use a calm palette for focused sessions.</span>
            </div>
            <div className="segmented" role="group" aria-label="Theme preference">
              {(['light', 'dark', 'system'] as ThemePreference[]).map((option) => (
                <button
                  key={option}
                  className={settings.theme === option ? 'selected' : ''}
                  aria-pressed={settings.theme === option}
                  onClick={() => update('theme', option)}
                >
                  {option[0].toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Reduced motion</strong>
              <span>Use fewer interface transitions.</span>
            </div>
            <Switch on={settings.reducedMotion} onToggle={() => update('reducedMotion', !settings.reducedMotion)} label="Reduced motion" />
          </div>
        </div>

        <div className="settings-card card">
          <div className="setting-title">
            <div className="setting-icon cyan">
              <Code2 size={18} />
            </div>
            <div>
              <h2>Editor</h2>
              <p>Set up a comfortable coding view.</p>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Editor font size</strong>
              <span>Comfortable for your screen.</span>
            </div>
            <select
              value={settings.fontSize}
              onChange={(event) => update('fontSize', Number(event.target.value))}
              aria-label="Editor font size"
            >
              {[13, 14, 16, 18].map((size) => (
                <option key={size} value={size}>
                  {size} px
                </option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <div>
              <strong>Word wrap</strong>
              <span>Wrap long lines instead of scrolling sideways.</span>
            </div>
            <Switch on={settings.wordWrap} onToggle={() => update('wordWrap', !settings.wordWrap)} label="Word wrap" />
          </div>
          <div className="setting-row">
            <div>
              <strong>Minimap</strong>
              <span>Show a small overview map in the editor.</span>
            </div>
            <Switch on={settings.minimap} onToggle={() => update('minimap', !settings.minimap)} label="Minimap" />
          </div>
        </div>

        <div className="settings-card card">
          <div className="setting-title">
            <div className="setting-icon violet">
              <Lightbulb size={18} />
            </div>
            <div>
              <h2>Learning</h2>
              <p>Adjust the level of support you receive.</p>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Explanation level</strong>
              <span>Used when creating local guidance.</span>
            </div>
            <select
              value={settings.explanationLevel}
              onChange={(event) => update('explanationLevel', event.target.value as ExplanationLevel)}
              aria-label="Explanation level"
            >
              {['Beginner', 'Intermediate', 'Advanced'].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <div>
              <strong>Hint level</strong>
              <span>Gentle, guided or learning-style hints.</span>
            </div>
            <select
              value={settings.hintLevel}
              onChange={(event) => update('hintLevel', event.target.value as HintLevel)}
              aria-label="Hint level"
            >
              {['Gentle', 'Guided', 'Learning'].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <div>
              <strong>Default language</strong>
              <span>Applied when you open the Playground.</span>
            </div>
            <select
              value={settings.defaultLanguage}
              onChange={(event) => update('defaultLanguage', event.target.value as LanguageName)}
              aria-label="Default language"
            >
              {languageNames.map((name) => (
                <option key={name} value={name} disabled={!isLanguageAvailable(name)}>
                  {languageOptionLabel(name)}
                </option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <div>
              <strong>Automatic local visuals</strong>
              <span>Prepare the visual logic view with local analysis.</span>
            </div>
            <Switch
              on={settings.automaticVisuals}
              onToggle={() => update('automaticVisuals', !settings.automaticVisuals)}
              label="Automatic local visuals"
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>Automatic local quiz readiness</strong>
              <span>Prepare safe quiz questions from detected concepts.</span>
            </div>
            <Switch
              on={settings.automaticQuizReadiness}
              onToggle={() => update('automaticQuizReadiness', !settings.automaticQuizReadiness)}
              label="Automatic local quiz readiness"
            />
          </div>
        </div>

        <div className="settings-card card">
          <div className="setting-title">
            <div className="setting-icon cyan">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2>Privacy &amp; Data</h2>
              <p>Your local settings and saved learning data stay in this browser.</p>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Autosave</strong>
              <span>Keep your working draft in this browser as you type.</span>
            </div>
            <Switch on={settings.autosave} onToggle={() => update('autosave', !settings.autosave)} label="Autosave" />
          </div>
          <div className="privacy-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>Local-first by default</strong>
              <p>
                CodeMentor AI never automatically uploads your source. Optional AI and secure runners require explicit configuration on
                the server, and secrets never reach the browser.
              </p>
            </div>
          </div>
          {!confirming ? (
            <Button variant="outline" icon={Trash2} onClick={() => setConfirming(true)}>
              Clear local data
            </Button>
          ) : (
            <div className="confirm-row">
              <Pill tone="amber">This removes saved projects, drafts and quiz history</Pill>
              <Button variant="danger" icon={Trash2} onClick={clearData}>
                Yes, clear local data
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>

        <div className="settings-card card">
          <div className="setting-title">
            <div className="setting-icon violet">
              <Sparkles size={18} />
            </div>
            <div>
              <h2>AI Deep Help</h2>
              <p>Optional guidance when you ask for another perspective.</p>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Enable AI Deep Help</strong>
              <span>Only used when you explicitly request deeper guidance.</span>
            </div>
            <Switch on={settings.aiDeepHelp} onToggle={() => update('aiDeepHelp', !settings.aiDeepHelp)} label="AI Deep Help" />
          </div>
        </div>
      </div>
    </div>
  );
}
