pub struct Counter {
    pub count: usize,
}

impl Counter {
    pub fn new() -> Self {
        Counter { count: 0 }
    }

    pub fn add(&mut self, amount: usize) -> usize {
        self.count += amount;
        self.count
    }
}
