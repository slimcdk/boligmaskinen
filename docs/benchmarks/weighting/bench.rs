use std::time::Instant;

const N: usize = 4_251_411;

#[inline(always)]
fn ramp(x: f32, full: f32, zero: f32) -> f32 {
    ((zero - x) / (zero - full)).clamp(0.0, 1.0)
}

fn main() {
    let mut seed: u64 = 42;
    let mut rand = || { seed = (seed * 1103515245 + 12345) % 2147483648; seed as f32 / 2147483648.0 };
    let (mut forest, mut noise, mut school, mut zone) = (vec![0f32; N], vec![0f32; N], vec![0f32; N], vec![0f32; N]);
    for i in 0..N {
        forest[i] = rand() * 8000.0;
        noise[i] = if rand() < 0.05 { f32::NAN } else { 40.0 + rand() * 35.0 };
        school[i] = rand() * 10000.0;
        zone[i] = 1.0 + (rand() * 3.0).floor();
    }
    let mut out = vec![0f32; N];
    let mut hist = [0u32; 101];
    let mut run = |hist: &mut [u32; 101]| {
        *hist = [0; 101];
        for i in 0..N {
            let z = zone[i];
            if !(z == 1.0 || z == 2.0) { out[i] = -1.0; continue; }
            let (mut sum, mut w) = (0f32, 0f32);
            sum += 4.0 * ramp(forest[i], 300.0, 3000.0); w += 4.0;
            let n = noise[i];
            if !n.is_nan() { sum += 4.0 * ramp(n, 45.0, 65.0); w += 4.0; }
            sum += 2.0 * ramp(school[i], 1000.0, 5000.0); w += 2.0;
            let s = sum / w * 100.0;
            out[i] = s;
            hist[s.round() as usize] += 1;
        }
    };
    run(&mut hist);
    let mut times = vec![];
    for _ in 0..7 {
        let t = Instant::now();
        run(&mut hist);
        times.push(t.elapsed().as_secs_f64() * 1000.0);
    }
    times.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!("{:<44} {:>7.1} ms   (check {})", "Rust: loop (release)", times[3], hist[50]);
}
