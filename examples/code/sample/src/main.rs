use sample::Counter;

fn main() {
    let mut counter = Counter::new();
    counter.add(2);
    println!("{}", counter.count);
}
