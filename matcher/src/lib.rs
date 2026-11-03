use imara_diff::{Algorithm, Diff, IndentHeuristic, IndentLevel, InternedInput};
use nucleo_matcher::pattern::{CaseMatching, Normalization, Pattern};
use nucleo_matcher::{Config, Matcher, Utf32Str};

static mut MATCHER: Option<Matcher> = None;
static mut PATHS: Option<Matcher> = None;
static mut OUTPUT: Vec<u32> = Vec::new();

#[no_mangle]
pub extern "C" fn mt_alloc(len: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(len.max(1));
    let ptr = buffer.as_mut_ptr();
    core::mem::forget(buffer);
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn mt_free(ptr: *mut u8, len: usize) {
    drop(Vec::from_raw_parts(ptr, 0, len.max(1)));
}

unsafe fn text<'a>(ptr: *const u8, len: usize) -> &'a str {
    core::str::from_utf8_unchecked(core::slice::from_raw_parts(ptr, len))
}

#[allow(static_mut_refs)]
unsafe fn matcher(paths: u32) -> &'static mut Matcher {
    if paths != 0 {
        PATHS.get_or_insert_with(|| Matcher::new(Config::DEFAULT.match_paths()))
    } else {
        MATCHER.get_or_insert_with(|| Matcher::new(Config::DEFAULT))
    }
}

#[no_mangle]
pub unsafe extern "C" fn mt_pattern(ptr: *const u8, len: usize) -> *mut Pattern {
    Box::into_raw(Box::new(Pattern::parse(text(ptr, len), CaseMatching::Smart, Normalization::Smart)))
}

#[no_mangle]
pub unsafe extern "C" fn mt_pattern_free(pattern: *mut Pattern) {
    drop(Box::from_raw(pattern));
}

#[no_mangle]
pub unsafe extern "C" fn mt_score(pattern: *const Pattern, ptr: *const u8, len: usize, paths: u32) -> i64 {
    let mut buffer = Vec::new();
    let haystack = Utf32Str::new(text(ptr, len), &mut buffer);
    match (*pattern).score(haystack, matcher(paths)) {
        Some(score) => score as i64,
        None => -1,
    }
}

#[no_mangle]
#[allow(static_mut_refs)]
pub unsafe extern "C" fn mt_indices(pattern: *const Pattern, ptr: *const u8, len: usize, paths: u32) -> usize {
    let mut buffer = Vec::new();
    let haystack = Utf32Str::new(text(ptr, len), &mut buffer);
    OUTPUT.clear();
    let _ = (*pattern).indices(haystack, matcher(paths), &mut OUTPUT);
    OUTPUT.sort_unstable();
    OUTPUT.dedup();
    OUTPUT.len()
}

#[no_mangle]
#[allow(static_mut_refs)]
pub unsafe extern "C" fn mt_output() -> *const u32 {
    OUTPUT.as_ptr()
}

#[no_mangle]
#[allow(static_mut_refs)]
pub unsafe extern "C" fn mt_diff(before: *const u8, before_len: usize, after: *const u8, after_len: usize) -> usize {
    let input = InternedInput::new(text(before, before_len), text(after, after_len));
    let mut diff = Diff::compute(Algorithm::Histogram, &input);
    diff.postprocess_with_heuristic(&input, IndentHeuristic::new(|token| IndentLevel::for_ascii_line(input.interner[token].as_bytes().iter().copied(), 4)));
    OUTPUT.clear();
    for hunk in diff.hunks() {
        OUTPUT.extend([hunk.before.start, hunk.before.end, hunk.after.start, hunk.after.end]);
    }
    OUTPUT.len() / 4
}
