/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 MakerHip (Burger Studio) */
/* AMBIENT: the New Ambient creatures of Burger Studio, as a Felucca engine (fixed point, no buffers).
 * Each held note is one creature that calls by itself: it picks its own notes around the key, at its own pace.
 *
 * KIND (E0):
 *   FFLY  firefly: glassy FM pings on a pentatonic scale, one per call
 *   FROG  rain frog: low wooden croaks (a pulse chopped at ~40 Hz), in groups
 *   WHAL  sky whale: a slow song that glides from note to note
 *   CCDA  night cicada: a shimmering high buzz that swells in waves
 *   OWL   moon owl: soft breathy hoots that fall a little
 *   JLLY  jellyfish: a floating pad of two detuned saws, its filter breathing
 *   WIND  wind spirit: whistling air, noise through a wandering resonant band
 * RATE (E1) how often it calls, MOVE (E2) how far its notes wander, BRIT (E3) the brightness (+ the track's FLT),
 * AIR (E4) breath noise, LIFE (E5) how long a call rings, WOBL (E6) slow vibrato / swell, SPRD (E7) octave jumps.
 * No library calls and no 64-bit arithmetic in the audio path (the constants below fold at compile time).
 *
 * State: ph[0] the main phase, ph[1] the second / modulator phase, ph[2] the slow LFO; s[0] the random generator,
 * s[1] a one-pole low-pass, s[2] the call envelope (Q15), s[3] samples to the next call, s[4] the pitch offset now
 * (1/16 semitone, Q8), s[5] its target, s[6] / s[7] the band filter (WIND, FROG). */
static const char *const N_CRIT_KIND[] = {"FFLY", "FROG", "WHAL", "CCDA", "OWL", "JLLY", "WIND"};
enum { CR_FFLY, CR_FROG, CR_WHAL, CR_CCDA, CR_OWL, CR_JLLY, CR_WIND, CR_N };
static const int8_t CR_PENTA[8] = {0, 3, 5, 7, 10, 12, 15, 17};
/* the kinds' levels (Q8), so a creature sits near the other engines' level */
static const int16_t CR_GAIN[CR_N] = {420, 900, 120, 330, 400, 150, 300};
#define CR_HZ10 ((uint32_t)((1ull << 32) / (10u * (uint32_t)FS)))   /* phase increment of 0.1 Hz */
#define CR_HZ ((uint32_t)((1ull << 32) / (uint32_t)FS))             /* .. of 1 Hz */

/* a phase increment's frequency as a Chamberlin SVF coefficient 2 sin(pi f / FS), Q15: inc * 2 pi / 2^17 */
static inline int32_t crit_f(uint32_t inc)
{
    uint32_t f = inc / 20861u;
    return (int32_t)(f > 24000u ? 24000u : f < 8u ? 8u : f);
}

static inline uint32_t crit_inc(int32_t pitch16)
{
    return pitch_inc((uint32_t)clamp(pitch16, 0, 2047));
}

/* samples between calls at RATE 0..127: ~2.4 s down to ~40 ms, with a random spread */
static int32_t crit_gap(const int16_t *p, int32_t *rng, uint32_t kind)
{
    int32_t base = (FS * 12 / 5) >> (p[P_E1] * 6 / 127);
    uint32_t r = noise32(rng);
    int32_t g = base / 2 + (int32_t)((uint32_t)base * (r & 1023u) >> 10);
    if (kind == CR_FROG && (r & 0x30000u))           /* frogs croak in groups: mostly short gaps */
        g = base / 5 + (int32_t)((r >> 20) & 255u) * 16;
    return g < CTL ? CTL : g;
}

/* a new note to call: around the key, MOVE semitones wide, on the pentatonic for the tonal kinds; SPRD adds octaves */
static int32_t crit_target(const int16_t *p, int32_t *rng, uint32_t kind)
{
    uint32_t r = noise32(rng);
    int32_t mv = p[P_E2], st;
    int32_t span = 1 + mv * 8 / 127;                  /* 1 .. 9 scale steps */
    st = CR_PENTA[(r >> 8) % (uint32_t)(span > 8 ? 8 : span)];
    if (kind == CR_WIND || kind == CR_WHAL)
        st = (int32_t)((r >> 8) % (uint32_t)(1 + mv / 6)) - mv / 12;   /* free, up and down */
    if (p[P_E7] && ((r >> 20) & 127u) < (uint32_t)p[P_E7])
        st += (r & 0x800000u) ? 12 : -12;
    return st * 16 * 256;
}

static void crit_note_on(track_t *t, voice_t *v)
{
    uint32_t seed = (v->note + 7u) * 0x9E3779B9u ^ (uint32_t)v->fine * 0x85EBCA6Bu ^ v->age * 0x27D4EB2Du;
    uint32_t kind = (uint32_t)t->p[P_E0] % CR_N;
    v->ph[0] = v->ph[1] = 0;
    v->ph[2] = seed;                                   /* each creature's LFO starts elsewhere */
    v->s[0] = (int32_t)(seed ? seed : 1u);
    v->s[1] = 0;
    v->s[2] = kind == CR_WHAL || kind == CR_CCDA || kind == CR_JLLY || kind == CR_WIND ? 32767 : 0;
    v->s[3] = 0;                                       /* the first call at once */
    v->s[4] = v->s[5] = 0;
    v->s[6] = v->s[7] = 0;
}

static void crit_render(track_t *t, voice_t *v, int32_t *out, uint32_t n, const vmod_t *m)
{
    const int16_t *p = t->p;
    uint32_t kind = (uint32_t)p[P_E0] % CR_N, i;
    uint32_t ph0 = v->ph[0], ph1 = v->ph[1], ph2 = v->ph[2];
    int32_t rng = v->s[0], lp = v->s[1], env = v->s[2], cnt = v->s[3], off = v->s[4], tgt = v->s[5];
    int32_t b1 = v->s[6], b2 = v->s[7];
    int32_t brit = clamp(p[P_E3] + (m->cutoff >> 8), 0, 127), air = p[P_E4], life = p[P_E5], wobl = p[P_E6];
    int32_t lpa, dec, glide, vib, pitch, lfo, fband, qband;
    uint32_t inc, inc2, linc;
    int continuous = kind == CR_WHAL || kind == CR_CCDA || kind == CR_JLLY || kind == CR_WIND;

    /* a call: a new note (and for the calling kinds a new envelope) */
    cnt -= (int32_t)n;
    if (cnt <= 0) {
        cnt += crit_gap(p, &rng, kind);
        tgt = crit_target(p, &rng, kind);
        if (kind == CR_FFLY || kind == CR_FROG)
            off = tgt;                                 /* pings and croaks jump */
        if (kind == CR_OWL)
            off = tgt + 3 * 16 * 256;                  /* a hoot starts high and falls */
        if (!continuous)
            env = 32767;
    }
    /* the pitch glides to its target: fast for the owl, slow for the whale, the wind wanders */
    glide = kind == CR_OWL ? 3 : kind == CR_WHAL ? 7 : kind == CR_WIND ? 8 : 5;
    off += (tgt - off) >> glide;
    /* the slow LFO, 0.08 .. 6 Hz: vibrato (WOBL), the cicada's swell, the jellyfish's breath */
    linc = (1u + (uint32_t)wobl / 2u) * CR_HZ10;
    if (kind == CR_CCDA)
        linc = (2u + (uint32_t)p[P_E1] / 8u) * CR_HZ10;
    lfo = sine_i(ph2);
    ph2 += linc * n;
    vib = kind == CR_JLLY || kind == CR_CCDA ? 0 : (lfo * wobl) >> 15;   /* up to ~8 semitones / 16 */
    pitch = m->pitch16 + (off >> 8) + (vib >> 4);
    if (kind == CR_FFLY)
        pitch += 24 * 16;                              /* two octaves up: tiny bells */
    else if (kind == CR_CCDA)
        pitch += 36 * 16;
    else if (kind == CR_FROG)
        pitch -= 12 * 16;
    inc = crit_inc(pitch);
    /* the call's ring: LIFE 0 short (~40 ms) .. 127 long (~2 s); decays a sample, Q15 */
    dec = 32767 - (int32_t)((2400u * 44100u / (uint32_t)FS) >> (life * 6 / 127));
    if (dec < 30000)
        dec = 30000;
    if (kind == CR_FROG)
        dec = 32767 - ((32767 - dec) * 3);
    /* the brightness: a one-pole low-pass, ~300 Hz .. open */
    lpa = 1200 + brit * brit * 2;
    if (lpa > 32767)
        lpa = 32767;

    switch (kind) {
    case CR_FFLY: inc2 = inc + (inc >> 1) + inc * 2u; break;      /* x3.5: a bell's partial */
    case CR_FROG: inc2 = (30u + (uint32_t)p[P_E2] / 8u) * CR_HZ; break;    /* the croak's ratchet, 30 .. 45 Hz */
    case CR_JLLY: inc2 = inc + (inc >> 8) + (inc >> 9); break;    /* +0.6 % */
    case CR_WHAL: inc2 = inc >> 1; break;                         /* an octave under */
    default: inc2 = inc * 2u; break;
    }

    /* the band filters (FROG: its wood at 4x the note, WIND: its whistle at the note), once a block */
    fband = crit_f(kind == CR_FROG ? inc * 4u : inc);
    qband = clamp(6000 - brit * 40, 900, 6000);

    for (i = 0; i < n; i++) {
        int32_t x = 0, nz = (int32_t)(noise32(&rng) >> 17) - 16384;
        switch (kind) {
        case CR_FFLY: {
            int32_t idx = (env >> 2) * (2 + brit / 16);               /* the FM index falls with the ping (up to ~1 pi) */
            x = sine_i(ph0 + (uint32_t)mul_wrap(sine_i(ph1), idx));
            x = (x * env) >> 15;
            break;
        }
        case CR_FROG: {
            int32_t chop = sine_i(ph1);                               /* ~40 Hz: the croak's ratchet */
            int32_t pul = osc_pulse(ph0, inc, 0x50000000u);
            x = (pul * (16384 + (chop >> 1))) >> 15;
            /* wooden: a resonant band at 4x the note */
            {
                int32_t f = fband, hi;
                b2 += (f * b1) >> 15;
                hi = x - b2 - (b1 >> 1);
                b1 += (f * hi) >> 15;
                b1 = clamp(b1, -60000, 60000);
                b2 = clamp(b2, -60000, 60000);
                x = (b1 * 3) >> 1;
            }
            x = (x * env) >> 15;
            break;
        }
        case CR_WHAL:
            x = sine_i(ph0) - (sine_i(ph0) >> 2) + (osc_tri(ph1) >> 2) + (sine_i(ph0 * 3u) >> 4);
            break;
        case CR_CCDA: {
            int32_t buzz = osc_pulse(ph0, inc, 0x30000000u);
            int32_t am = 16384 + (sine_i(ph1) >> 1);                  /* fast tremolo at 2x the pitch: shimmer */
            int32_t swell = 16384 + (lfo >> 1);
            x = (((buzz * am) >> 15) * swell) >> 15;
            break;
        }
        case CR_OWL:
            x = sine_i(ph0) + (sine_i(ph1) >> 3);
            x = (x * env) >> 15;
            break;
        case CR_JLLY: {
            int32_t sw = osc_saw(ph0, inc) + osc_saw(ph1, inc2);
            x = sw >> 1;
            break;
        }
        default: {                                                    /* WIND: noise through a wandering band */
            int32_t f = fband, hi;
            b2 += (f * b1) >> 15;
            hi = nz - b2 - ((b1 * qband) >> 12);
            b1 += (f * hi) >> 15;
            b1 = clamp(b1, -80000, 80000);
            b2 = clamp(b2, -80000, 80000);
            x = b1 * 2;
            break;
        }
        }
        /* breath noise, in the call */
        if (air && kind != CR_WIND)
            x += (((nz * air) >> 7) * (continuous ? 16384 : env)) >> 16;
        /* the low-pass (the jellyfish breathes: its brightness follows the LFO); 32-bit: |x - lp| < 2^16 */
        x = clamp(x, -32767, 32767);
        if (kind == CR_JLLY)
            lp += ((x - lp) * clamp(lpa + ((lfo * (lpa >> 1)) >> 15), 200, 32767)) >> 15;
        else
            lp += ((x - lp) * lpa) >> 15;
        x = soft_knee((lp * CR_GAIN[kind]) >> 8, 26000);
        out[i] += voice_amp(x, m, i);
        ph0 += inc;
        ph1 += inc2;
        if (!continuous)
            env = (env * dec) >> 15;
    }
    v->ph[0] = ph0;
    v->ph[1] = ph1;
    v->ph[2] = ph2;
    v->s[0] = rng;
    v->s[1] = lp;
    v->s[2] = env;
    v->s[3] = cnt;
    v->s[4] = off;
    v->s[5] = tgt;
    v->s[6] = b1;
    v->s[7] = b2;
}

static const preset_t CRIT_PRESETS[] = {
    {"FIREFLY", {CR_FFLY, 70, 70, 90, 0, 60, 10, 30}, {0, 90, 127, 100}, 0, 0, FX(0, 20, 40, 90), PAT(0)},
    {"RAIN FROG", {CR_FROG, 64, 30, 60, 10, 30, 0, 0}, {0, 90, 127, 40}, 0, 0, FX(0, 0, 20, 60), PAT(0)},
    {"SKY WHALE", {CR_WHAL, 25, 90, 50, 10, 0, 40, 30}, {70, 90, 127, 110}, 0, 0, FX(0, 40, 30, 110), PAT(0)},
    {"NIGHT CICADA", {CR_CCDA, 50, 20, 90, 20, 0, 50, 0}, {60, 90, 110, 90}, 0, 0, FX(0, 20, 10, 70), PAT(0)},
    {"MOON OWL", {CR_OWL, 40, 40, 40, 50, 70, 15, 10}, {5, 90, 127, 80}, 0, 0, FX(0, 0, 40, 100), PAT(0)},
    {"JELLYFISH", {CR_JLLY, 30, 30, 50, 10, 0, 40, 0}, {90, 90, 127, 110}, 0, 0, FX(0, 70, 20, 100), PAT(0)},
    {"WIND SPIRIT", {CR_WIND, 40, 100, 80, 0, 0, 50, 20}, {80, 90, 127, 110}, 0, 0, FX(0, 30, 10, 110), PAT(0)},
};

static const engine_t ENG_CRITTER = {
    .name = "AMBIENT",
    .page_title = {"CALL", "BODY"},
    .edit = {
        {"KIND", F_ENUM, 0, CR_N - 1, 0, N_CRIT_KIND, 0},
        {"RATE", F_PCT, 0, 127, 64, 0, 0},
        {"MOVE", F_PCT, 0, 127, 64, 0, 0},
        {"BRIT", F_PCT, 0, 127, 80, 0, 0},
        {"AIR", F_PCT, 0, 127, 0, 0, 0},
        {"LIFE", F_PCT, 0, 127, 50, 0, 0},
        {"WOBL", F_PCT, 0, 127, 20, 0, 0},
        {"SPRD", F_PCT, 0, 127, 0, 0, 0},
    },
    .presets = CRIT_PRESETS,
    .npresets = NELEM(CRIT_PRESETS),
    .note_on = crit_note_on,
    .render = crit_render,
    .knob = {P_E0, P_E1, P_E2, P_E3},
    .poly = 4,                   /* creatures are busy: four at once a part */
    .keep = 0x03,                /* a retrigger keeps the random generator and the low-pass */
};
