// Grove Gesture v1 (PAJ7620U2) -> Bridge -> python -> browser.
// Init table from Seeed-Studio/Gesture_PAJ7620 (MIT).

#include <Arduino_RouterBridge.h>
#include <Wire.h>

// Gesture -> move mapping. Swap if the sensor is mounted rotated.
#define MOVE_RIGHT "right"
#define MOVE_LEFT "left"
#define MOVE_UP "jump"
#define MOVE_DOWN "duck"
#define MOVE_CW "track"
#define MOVE_CCW "track_prev"
#define MOVE_FORWARD "shoot"
#define MOVE_BACKWARD "pause"
#define MOVE_WAVE "wave"

const uint8_t PAJ_ADDR = 0x73;
const unsigned long POLL_MS = 50;
#define GAME_MODE 1  // 1 = 240 fps sensor sampling, 0 = 120 fps
const unsigned long STATUS_MS = 5000;

// PAJ7620 result register 0x43 bits.
const uint8_t BIT_RIGHT = 0x01;
const uint8_t BIT_LEFT = 0x02;
const uint8_t BIT_UP = 0x04;
const uint8_t BIT_DOWN = 0x08;
const uint8_t BIT_FORWARD = 0x10;
const uint8_t BIT_BACKWARD = 0x20;
const uint8_t BIT_CW = 0x40;
const uint8_t BIT_CCW = 0x80;
// Reg 0x44 bit0 = wave (reported as 0x100 in the 16-bit raw value).
const uint8_t BIT_WAVE = 0x01;

const uint8_t initRegisterArray[][2] = {
    {0xEF,0x00}, {0x37,0x07}, {0x38,0x17}, {0x39,0x06}, {0x42,0x01},
    {0x46,0x2D}, {0x47,0x0F}, {0x48,0x3C}, {0x49,0x00}, {0x4A,0x1E},
    {0x4C,0x20}, {0x51,0x10}, {0x5E,0x10}, {0x60,0x27}, {0x80,0x42},
    {0x81,0x44}, {0x82,0x04}, {0x8B,0x01}, {0x90,0x06}, {0x95,0x0A},
    {0x96,0x0C}, {0x97,0x05}, {0x9A,0x14}, {0x9C,0x3F}, {0xA5,0x19},
    {0xCC,0x19}, {0xCD,0x0B}, {0xCE,0x13}, {0xCF,0x64}, {0xD0,0x21},
    {0xEF,0x01}, {0x02,0x0F}, {0x03,0x10}, {0x04,0x02}, {0x25,0x01},
    {0x27,0x39}, {0x28,0x7F}, {0x29,0x08}, {0x3E,0xFF}, {0x5E,0x3D},
    {0x65,0x96}, {0x67,0x97}, {0x69,0xCD}, {0x6A,0x01}, {0x6D,0x2C},
    {0x6E,0x01}, {0x72,0x01}, {0x73,0x35}, {0x77,0x01}, {0xEF,0x00},
};
const size_t INIT_SIZE = sizeof(initRegisterArray) / sizeof(initRegisterArray[0]);

TwoWire *bus = nullptr;
String statusMsg = "";
bool sensorOk = false;
unsigned long lastPoll = 0;
unsigned long lastStatus = 0;

String scanBus(TwoWire &w, const char *name, bool &hasPaj) {
  String s = String(name) + ":";
  hasPaj = false;
  for (uint8_t a = 1; a < 127; a++) {
    w.beginTransmission(a);
    if (w.endTransmission() == 0) {
      s += " 0x";
      if (a < 16) s += "0";
      s += String(a, HEX);
      if (a == PAJ_ADDR) hasPaj = true;
    }
  }
  return s;
}

bool writeReg(uint8_t reg, uint8_t val) {
  bus->beginTransmission(PAJ_ADDR);
  bus->write(reg);
  bus->write(val);
  return bus->endTransmission() == 0;
}

bool readReg(uint8_t reg, uint8_t &val) {
  bus->beginTransmission(PAJ_ADDR);
  bus->write(reg);
  if (bus->endTransmission() != 0) return false;
  if (bus->requestFrom(PAJ_ADDR, (uint8_t)1) != 1) return false;
  val = bus->read();
  return true;
}

bool pajInit() {
  uint8_t v = 0;
  delay(1);
  // Wake-up: first access may NACK.
  readReg(0x00, v);
  delay(1);
  writeReg(0xEF, 0x00);
  uint8_t id0 = 0, id1 = 0;
  if (!readReg(0x00, id0) || !readReg(0x01, id1)) return false;
  statusMsg += " id=" + String(id1, HEX) + String(id0, HEX);
  if (id0 != 0x20) return false;
  for (size_t i = 0; i < INIT_SIZE; i++) {
    writeReg(initRegisterArray[i][0], initRegisterArray[i][1]);
  }
#if GAME_MODE
  // Bank 1 R_IDLE_TIME: 0x30 = 240 fps "game mode" (PixArt value, per RevEng_PAJ7620).
  writeReg(0xEF, 0x01);
  writeReg(0x65, 0x30);
#endif
  writeReg(0xEF, 0x00);
  return true;
}

void wakePaj(TwoWire &w) {
  // PAJ7620 NACKs the first access after power-up while it wakes.
  for (int i = 0; i < 3; i++) {
    w.beginTransmission(PAJ_ADDR);
    w.endTransmission();
    delay(5);
  }
}

void detectAndInit() {
  wakePaj(Wire);
  wakePaj(Wire1);
  bool p0 = false, p1 = false;
  statusMsg = scanBus(Wire, "Wire", p0) + " | " + scanBus(Wire1, "Wire1", p1);
  bus = nullptr;
  if (p0) bus = &Wire;
  else if (p1) bus = &Wire1;

  if (bus) {
    statusMsg += p0 ? " | PAJ on Wire" : " | PAJ on Wire1";
    sensorOk = pajInit();
    statusMsg += sensorOk ? (GAME_MODE ? " init OK game-mode" : " init OK") : " init FAIL";
  } else {
    statusMsg += " | PAJ7620 not found";
  }
}

bool setRaw(bool on);
void pollRaw(unsigned long now);

// --- Grove LCD RGB Backlight (register-level, no lib) ---
// Text controller 0x3E (control byte 0x80 = command, 0x40 = data stream).
// RGB backlight 0x62 (PCA9633, Seeed rgb_lcd v4 registers).
// Animation runs here at ~7 fps; python only sends mode/values/events.
const uint8_t LCD_ADDR = 0x3E;
const uint8_t RGB_ADDR = 0x62;
const unsigned long LCD_FRAME_MS = 140;  // ~7 fps render
const int LCD_CELLS_PER_CALL = 6;        // caps I2C time per loop() pass (~2-3 ms)
TwoWire *lcdBus = nullptr;
bool lcdOk = false;

// Screen modes (python "lcdm" arg 0) and events (arg 6).
enum { M_IDLE = 0, M_RUN = 1, M_PAUSE = 2, M_DEAD = 3, M_TEXT = 4 };
enum { EV_NONE = 0, EV_HIT = 1, EV_COIN = 2, EV_SHOOT = 3, EV_LEVEL = 4, EV_TURN = 5 };
const unsigned long EV_MS[] = {0, 900, 450, 600, 1500, 900};

// CGRAM glyph codes 0..7 (frame buffer is bytes, not C strings, so 0 is safe).
enum { G_HEART = 0, G_COIN, G_RUNA, G_RUNB, G_SPARK, G_BULLET, G_SKULL, G_ARROW };
const uint8_t GLYPHS[8][8] = {
    {0x00, 0x0A, 0x1F, 0x1F, 0x1F, 0x0E, 0x04, 0x00},  // heart
    {0x04, 0x0E, 0x1F, 0x1B, 0x1F, 0x0E, 0x04, 0x00},  // coin / diamond
    {0x06, 0x06, 0x0C, 0x16, 0x05, 0x0C, 0x12, 0x01},  // runner A (stride)
    {0x06, 0x06, 0x0C, 0x0E, 0x0C, 0x0C, 0x0A, 0x0A},  // runner B (pass)
    {0x00, 0x04, 0x15, 0x0E, 0x15, 0x04, 0x00, 0x00},  // spark / star
    {0x00, 0x00, 0x1C, 0x1F, 0x1C, 0x00, 0x00, 0x00},  // bullet
    {0x0E, 0x1F, 0x15, 0x1F, 0x0E, 0x0E, 0x0A, 0x00},  // skull
    {0x00, 0x04, 0x02, 0x1F, 0x02, 0x04, 0x00, 0x00},  // arrow (turn)
};

// Request from Bridge (written in RPC context, read in loop()).
volatile int lcdReqMode = M_IDLE, lcdReqScore = 0, lcdReqLives = -1, lcdReqAmmo = -1;
volatile int lcdReqCoins = -1, lcdReqLevel = -1, lcdReqBest = -1;
// Event ring (RPC thread writes head, loop() reads tail): one event per frame, none dropped.
volatile uint8_t lcdEvQ[4];
volatile uint8_t lcdEvHead = 0, lcdEvTail = 0;
char lcdNew1[17] = "", lcdNew2[17] = "";
uint8_t lcdNewR = 255, lcdNewG = 255, lcdNewB = 255;

uint8_t lcdFb[2][16];      // wanted frame
uint8_t lcdShadow[2][16];  // what the LCD shows
uint8_t lcdCurR = 1, lcdCurG = 1, lcdCurB = 1;
unsigned long lastFrameMs = 0;
uint32_t lcdFrameNo = 0;
int lcdEv = EV_NONE;
unsigned long lcdEvStart = 0;
int lcdLastMode = -1;
unsigned long lcdModeStart = 0;

void lcdCmd(uint8_t c) {
  lcdBus->beginTransmission(LCD_ADDR);
  lcdBus->write(0x80);
  lcdBus->write(c);
  lcdBus->endTransmission();
}

void lcdData(uint8_t d) {
  // One byte per transaction: the controller drops bytes in a burst write.
  lcdBus->beginTransmission(LCD_ADDR);
  lcdBus->write(0x40);
  lcdBus->write(d);
  lcdBus->endTransmission();
  delayMicroseconds(60);
}

void rgbReg(uint8_t reg, uint8_t val) {
  lcdBus->beginTransmission(RGB_ADDR);
  lcdBus->write(reg);
  lcdBus->write(val);
  lcdBus->endTransmission();
}

void lcdColor(uint8_t r, uint8_t g, uint8_t b) {
  if (r == lcdCurR && g == lcdCurG && b == lcdCurB) return;
  rgbReg(0x04, r);
  rgbReg(0x03, g);
  rgbReg(0x02, b);
  lcdCurR = r; lcdCurG = g; lcdCurB = b;
}

bool i2cAck(TwoWire &w, uint8_t a) {
  w.beginTransmission(a);
  return w.endTransmission() == 0;
}

void lcdLoadGlyphs() {
  for (uint8_t s = 0; s < 8; s++) {
    lcdCmd(0x40 | (s << 3));
    delayMicroseconds(100);
    for (uint8_t i = 0; i < 8; i++) lcdData(GLYPHS[s][i]);
  }
  lcdCmd(0x80);  // back to DDRAM
  delayMicroseconds(100);
}

// Writes only cells that differ from the shadow, at most `budget` per call.
void lcdFlush(int budget) {
  for (uint8_t row = 0; row < 2 && budget > 0; row++) {
    int addrNext = -1;
    for (uint8_t c = 0; c < 16 && budget > 0; c++) {
      uint8_t ch = lcdFb[row][c];
      if (ch == lcdShadow[row][c]) continue;
      if (addrNext != c) {  // DDRAM auto-increments; re-address only after a gap
        lcdCmd((row ? 0xC0 : 0x80) + c);
        delayMicroseconds(60);
      }
      lcdData(ch);
      lcdShadow[row][c] = ch;
      addrNext = c + 1;
      budget--;
    }
  }
}

// --- frame helpers ---
void fbClear(uint8_t row) { memset(lcdFb[row], ' ', 16); }
void fbText(uint8_t row, int col, const char *s) {
  for (; *s && col < 16; s++, col++) if (col >= 0) lcdFb[row][col] = (uint8_t)*s;
}
void fbCenter(uint8_t row, const char *s) { fbText(row, (16 - (int)strlen(s)) / 2, s); }
void fbPut(uint8_t row, int col, uint8_t ch) { if (col >= 0 && col < 16) lcdFb[row][col] = ch; }
void fbMarquee(uint8_t row, const char *s, uint32_t off) {
  size_t n = strlen(s);
  if (n == 0) return;
  for (int i = 0; i < 16; i++) lcdFb[row][i] = (uint8_t)s[(off + i) % n];
}
uint8_t tri(unsigned long t, unsigned long period) {  // 0..255..0 over period
  unsigned long p = (t % period) * 510 / period;
  return p < 256 ? p : 510 - p;
}
void wheel(uint8_t h, uint8_t &r, uint8_t &g, uint8_t &b) {
  if (h < 85) { r = 255 - h * 3; g = h * 3; b = 0; }
  else if (h < 170) { h -= 85; r = 0; g = 255 - h * 3; b = h * 3; }
  else { h -= 170; r = h * 3; g = 0; b = 255 - h * 3; }
}
uint8_t scale(uint8_t v, uint8_t k) { return (uint16_t)v * k / 255; }

void renderIdle(unsigned long t, uint8_t &r, uint8_t &g, uint8_t &b) {
  fbClear(0); fbClear(1);
  fbCenter(0, "LLAMA DRAMA");
  bool tw = (lcdFrameNo / 3) & 1;
  fbPut(0, 1, tw ? G_SPARK : '*');
  fbPut(0, 14, tw ? '*' : G_SPARK);
  int x = (int)(lcdFrameNo % 22) - 3;  // runner crosses row 2 and wraps
  fbPut(1, x, (lcdFrameNo & 1) ? G_RUNA : G_RUNB);
  fbPut(1, x - 1, G_SPARK);
  fbPut(1, x - 2, '*');
  fbPut(1, x - 3, '.');
  uint8_t hr, hg, hb;
  wheel((t / 24) & 0xFF, hr, hg, hb);
  uint8_t k = 90 + scale(tri(t, 3000), 165);  // slow breathe
  r = scale(hr, k); g = scale(hg, k); b = scale(hb, k);
}

void renderRun(unsigned long t, uint8_t &r, uint8_t &g, uint8_t &b) {
  char buf[17];
  int lives = lcdReqLives, ammo = lcdReqAmmo, coins = lcdReqCoins, level = lcdReqLevel;
  fbClear(0); fbClear(1);
  // Row 1: coin + coins left, score right-aligned.
  int col = 0;
  if (coins >= 0) {
    fbPut(0, 0, G_COIN);
    snprintf(buf, sizeof(buf), "%d", coins);
    fbText(0, 1, buf);
    col = 1 + strlen(buf);
  }
  snprintf(buf, sizeof(buf), "%d", lcdReqScore);
  int sx = 16 - (int)strlen(buf);
  if (sx <= col) sx = col + 1;
  fbText(0, sx, buf);
  // Row 2: hearts, ammo bullets (or level), runner on the right.
  col = 0;
  if (lives >= 0) {
    int n = lives > 5 ? 5 : lives;
    for (int i = 0; i < n; i++) fbPut(1, col++, G_HEART);
    if (lives > 5) { snprintf(buf, sizeof(buf), "%d", lives); fbText(1, col, buf); col += strlen(buf); }
    col++;
  }
  if (ammo >= 0) {
    int n = ammo > 5 ? 5 : ammo;
    for (int i = 0; i < n; i++) fbPut(1, col++, G_BULLET);
    if (ammo > 5) { fbPut(1, col++, '+'); }
  } else if (level >= 0) {
    snprintf(buf, sizeof(buf), "L%d", level);
    fbText(1, col, buf);
  }
  // Faster stride at higher levels.
  int lv = level > 0 ? level : 1;
  unsigned long period = lv >= 8 ? 140 : 420 - lv * 40;
  bool fA = (t / period) & 1;
  fbPut(1, 15, fA ? G_RUNA : G_RUNB);
  fbPut(1, 14, fA ? '.' : ' ');
  // Backlight by lives.
  if (lives == 2) { r = 255; g = 180; b = 0; }
  else if (lives == 1) { uint8_t k = 70 + scale(tri(t, 800), 185); r = k; g = 0; b = 0; }
  else { r = 30; g = 255; b = 60; }
}

void renderPause(unsigned long t, uint8_t &r, uint8_t &g, uint8_t &b) {
  char buf[17];
  fbClear(0); fbClear(1);
  if ((t / 500) & 1) fbCenter(0, "PAUSED");
  snprintf(buf, sizeof(buf), "SCORE %d", lcdReqScore);
  fbCenter(1, buf);
  r = 255; g = 110; b = 0;
}

void renderDead(unsigned long t, uint8_t &r, uint8_t &g, uint8_t &b) {
  char buf[48];
  fbClear(0); fbClear(1);
  fbText(0, 3, "GAME OVER");
  fbPut(0, 1, G_SKULL);
  fbPut(0, 13, G_SKULL);
  if (lcdReqBest >= 0) snprintf(buf, sizeof(buf), "SCORE %d  BEST %d  ", lcdReqScore, lcdReqBest);
  else snprintf(buf, sizeof(buf), "SCORE %d   ", lcdReqScore);
  fbMarquee(1, buf, (t - lcdModeStart) / 280);
  uint8_t k = 40 + scale(tri(t, 2400), 215);  // red fade
  r = k; g = 0; b = 0;
}

void renderText(unsigned long, uint8_t &r, uint8_t &g, uint8_t &b) {
  fbClear(0); fbClear(1);
  fbText(0, 0, lcdNew1);
  fbText(1, 0, lcdNew2);
  r = lcdNewR; g = lcdNewG; b = lcdNewB;
}

// Event overlays on top of the running screen.
void renderEvent(unsigned long t, uint8_t &r, uint8_t &g, uint8_t &b) {
  unsigned long e = t - lcdEvStart;
  switch (lcdEv) {
    case EV_HIT: {
      bool on = ((e / 150) & 1) == 0;  // 3 red flashes
      r = on ? 255 : 20; g = 0; b = 0;
      fbClear(1);
      fbCenter(1, "OUCH!");
      fbPut(1, 3, G_SKULL);
      fbPut(1, 11, G_SKULL);
      break;
    }
    case EV_COIN: {
      fbPut(0, 0, (e / 140) & 1 ? G_COIN : G_SPARK);
      int c = 1;
      while (c < 16 && lcdFb[0][c] != ' ') c++;
      fbPut(0, c, G_SPARK);
      if (e < 220) { r = 255; g = 210; b = 0; }
      break;
    }
    case EV_SHOOT: {
      int x = (int)(e * 17 / EV_MS[EV_SHOOT]);
      fbPut(1, x - 1, '-');
      fbPut(1, x, G_BULLET);
      if (e < 140) { r = 255; g = 255; b = 255; }
      break;
    }
    case EV_LEVEL: {
      char buf[40];
      int lv = lcdReqLevel;
      if (lv >= 0) snprintf(buf, sizeof(buf), "LEVEL UP! L%d    ", lv);
      else snprintf(buf, sizeof(buf), "LEVEL UP!    ");
      fbMarquee(0, buf, e / 120);
      fbClear(1);
      for (int i = 0; i < 16; i++) if (((i + lcdFrameNo) % 3) == 0) fbPut(1, i, G_SPARK);
      wheel((e / 6) & 0xFF, r, g, b);  // fast rainbow
      break;
    }
    case EV_TURN: {
      bool on = ((e / 150) & 1) == 0;
      for (int i = 12; i < 16; i++) fbPut(1, i, on ? G_ARROW : ' ');
      break;
    }
  }
}

void lcdInit() {
  lcdBus = nullptr;
  if (i2cAck(Wire, LCD_ADDR)) lcdBus = &Wire;
  else if (i2cAck(Wire1, LCD_ADDR)) lcdBus = &Wire1;
  lcdOk = lcdBus != nullptr;
  if (!lcdOk) return;
  delay(50);
  lcdCmd(0x28);  // function set: 2 lines, 5x8 (DL ignored over I2C)
  delay(5);
  lcdCmd(0x28);
  delayMicroseconds(150);
  lcdCmd(0x28);
  lcdCmd(0x0C);  // display on, cursor off, blink off
  lcdCmd(0x01);  // clear
  delay(2);
  lcdCmd(0x06);  // entry mode: left to right, no shift
  rgbReg(0x00, 0x00);  // MODE1: normal
  rgbReg(0x08, 0xFF);  // LEDOUT: PWM + group control
  rgbReg(0x01, 0x20);  // MODE2: as Seeed rgb_lcd
  lcdLoadGlyphs();
  memset(lcdShadow, ' ', sizeof(lcdShadow));  // matches the clear above
  memset(lcdFb, ' ', sizeof(lcdFb));
  lcdColor(255, 255, 255);
}

// Bridge "lcdm": stores mode/values/event; all I2C happens in loop().
bool lcdModeSet(int mode, int score, int lives, int ammo, int coins, int level, int event, int best) {
  lcdReqMode = constrain(mode, M_IDLE, M_DEAD);
  lcdReqScore = score;
  lcdReqLives = lives;
  lcdReqAmmo = ammo;
  lcdReqCoins = coins;
  lcdReqLevel = level;
  lcdReqBest = best;
  if (event > EV_NONE && event <= EV_TURN && (uint8_t)(lcdEvHead - lcdEvTail) < 4) {
    lcdEvQ[lcdEvHead & 3] = event;
    lcdEvHead = lcdEvHead + 1;
  }
  return lcdOk;
}

// Bridge "lcd" (legacy): plain text screen. Returns false when no LCD was found.
bool lcdSet(String l1, String l2, int r, int g, int b) {
  l1.toCharArray(lcdNew1, sizeof(lcdNew1));
  l2.toCharArray(lcdNew2, sizeof(lcdNew2));
  lcdNewR = constrain(r, 0, 255);
  lcdNewG = constrain(g, 0, 255);
  lcdNewB = constrain(b, 0, 255);
  lcdReqMode = M_TEXT;
  return lcdOk;
}

void lcdService(unsigned long now) {
  if (!lcdOk) return;
  if (now - lastFrameMs >= LCD_FRAME_MS) {
    lastFrameMs = now;
    lcdFrameNo++;
    int mode = lcdReqMode;
    if (mode != lcdLastMode) { lcdLastMode = mode; lcdModeStart = now; }
    if (lcdEvTail != lcdEvHead) {
      lcdEv = lcdEvQ[lcdEvTail & 3];
      lcdEvTail = lcdEvTail + 1;
      lcdEvStart = now;
    }
    if (lcdEv != EV_NONE && now - lcdEvStart >= EV_MS[lcdEv]) lcdEv = EV_NONE;
    uint8_t r = 255, g = 255, b = 255;
    switch (mode) {
      case M_RUN: renderRun(now, r, g, b); break;
      case M_PAUSE: renderPause(now, r, g, b); break;
      case M_DEAD: renderDead(now, r, g, b); break;
      case M_TEXT: renderText(now, r, g, b); break;
      default: renderIdle(now, r, g, b); break;
    }
    if (lcdEv != EV_NONE && (mode == M_RUN || lcdEv == EV_LEVEL)) renderEvent(now, r, g, b);
    lcdColor(r, g, b);
  }
  lcdFlush(LCD_CELLS_PER_CALL);
}
// --- end LCD ---

void setup() {
  Bridge.begin();
  Bridge.provide("set_raw", setRaw);
  Bridge.provide("lcd", lcdSet);
  Bridge.provide("lcdm", lcdModeSet);
  Wire.begin();
  Wire1.begin();
  delay(100);
  detectAndInit();
  lcdInit();
}

uint16_t lastRaw = 0;
unsigned long lastPushMs = 0;
const unsigned long PULL_AFTER_PUSH_MS = 1500;

// Raw object data for AI recording (bank 0, RevEng_PAJ7620.h:165-177).
// 0xAC/0xAD center X, 0xAE/0xAF center Y, 0xB0 brightness, 0xB1/0xB2 size.
const uint8_t REG_OBJ_FIRST = 0xAC;
const unsigned long RAW_MS = 20;   // 50 Hz
const int RAW_BATCH = 10;          // 5 notifies per second
volatile bool rawOn = false;       // toggled by python via Bridge "set_raw"
unsigned long lastRawMs = 0;
int rawCount = 0;
unsigned long rawT0 = 0;
String rawBuf = "";

bool setRaw(bool on) {
  rawOn = on;
  return true;
}

bool readObj(uint16_t &x, uint16_t &y, uint8_t &b, uint16_t &sz) {
  bus->beginTransmission(PAJ_ADDR);
  bus->write(REG_OBJ_FIRST);
  if (bus->endTransmission(false) != 0) return false;
  if (bus->requestFrom(PAJ_ADDR, (uint8_t)7) != 7) return false;
  uint8_t r[7];
  for (int i = 0; i < 7; i++) r[i] = bus->read();
  x = (uint16_t)(r[0] | ((r[1] & 0x1F) << 8));
  y = (uint16_t)(r[2] | ((r[3] & 0x1F) << 8));
  b = r[4];
  sz = (uint16_t)(r[5] | ((r[6] & 0x0F) << 8));
  return true;
}

void pollRaw(unsigned long now) {
  if (!rawOn) {
    rawCount = 0;
    rawBuf = "";
    return;
  }
  if (now - lastRawMs < RAW_MS) return;
  lastRawMs = now;
  uint16_t x = 0, y = 0, sz = 0;
  uint8_t b = 0;
  if (!readObj(x, y, b, sz)) return;
  if (rawCount == 0) rawT0 = now;
  rawBuf += String(x) + "," + String(y) + "," + String(b) + "," + String(sz) + ";";
  if (++rawCount >= RAW_BATCH) {
    Bridge.notify("raw", (int)rawT0, rawBuf);
    rawCount = 0;
    rawBuf = "";
  }
}

void sendMove(const char *move) {
  Bridge.notify("gesture", String(move), (int)lastRaw);
}

void loop() {
  unsigned long now = millis();

  // Repeat status so python sees it once it is up.
  if (now - lastStatus >= STATUS_MS) {
    lastStatus = now;
    Bridge.notify("sensor_status", statusMsg);
  }

  lcdService(now);

  if (!sensorOk) {
    // Retry detection every status period (sensor may be replugged).
    if (now - lastStatus < 20) detectAndInit();
    delay(50);
    return;
  }

  pollRaw(now);

  if (now - lastPoll < POLL_MS) return;
  lastPoll = now;

  uint8_t g = 0, w = 0;
  if (!readReg(0x43, g)) return;
  readReg(0x44, w);
  if (g == 0 && (w & BIT_WAVE) == 0) return;
  lastRaw = g | ((uint16_t)w << 8);

  if (g & BIT_CW) sendMove(MOVE_CW);
  else if (g & BIT_CCW) sendMove(MOVE_CCW);
  else if (g & BIT_RIGHT) sendMove(MOVE_RIGHT);
  else if (g & BIT_LEFT) sendMove(MOVE_LEFT);
  else if (g & BIT_UP) sendMove(MOVE_UP);
  else if (g & BIT_DOWN) sendMove(MOVE_DOWN);
  else if (g & BIT_FORWARD) { sendMove(MOVE_FORWARD); lastPushMs = millis(); }
  // Withdrawing the hand after a push reads as a pull; ignore pulls right after a push.
  else if (g & BIT_BACKWARD) { if (millis() - lastPushMs > PULL_AFTER_PUSH_MS) sendMove(MOVE_BACKWARD); }
  else if (w & BIT_WAVE) sendMove(MOVE_WAVE);
}
