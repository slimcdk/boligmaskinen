package main

import (
	"fmt"
	"math"
	"sort"
	"time"
)

const N = 4251411

func ramp(x, full, zero float32) float32 {
	u := (zero - x) / (zero - full)
	if u < 0 {
		return 0
	}
	if u > 1 {
		return 1
	}
	return u
}

func main() {
	seed := uint64(42)
	rand := func() float32 { seed = (seed*1103515245 + 12345) % 2147483648; return float32(seed) / 2147483648 }
	forest, noise, school, zone := make([]float32, N), make([]float32, N), make([]float32, N), make([]float32, N)
	for i := 0; i < N; i++ {
		forest[i] = rand() * 8000
		if rand() < 0.05 {
			noise[i] = float32(math.NaN())
		} else {
			noise[i] = 40 + rand()*35
		}
		school[i] = rand() * 10000
		zone[i] = 1 + float32(math.Floor(float64(rand()*3)))
	}
	out := make([]float32, N)
	var hist [101]uint32
	run := func() {
		hist = [101]uint32{}
		for i := 0; i < N; i++ {
			z := zone[i]
			if !(z == 1 || z == 2) {
				out[i] = -1
				continue
			}
			var sum, w float32
			sum += 4 * ramp(forest[i], 300, 3000)
			w += 4
			if n := noise[i]; n == n {
				sum += 4 * ramp(n, 45, 65)
				w += 4
			}
			sum += 2 * ramp(school[i], 1000, 5000)
			w += 2
			s := sum / w * 100
			out[i] = s
			hist[int(math.Round(float64(s)))]++
		}
	}
	run()
	times := []float64{}
	for r := 0; r < 7; r++ {
		t := time.Now()
		run()
		times = append(times, float64(time.Since(t).Microseconds())/1000)
	}
	sort.Float64s(times)
	fmt.Printf("%-44s %7.1f ms\n", "Go: loop", times[3])
}
