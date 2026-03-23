function solution(input) {
  const length = input.length;
  return input[Math.floor(length / 2)];
}
console.log(solution([1, 2, 3, 4, 5]))
console.log(solution([5, 6, 7, 8, 9]))
console.log(solution([1, 2, 3, 4]))

function solution2(input) {
  const length = input.length;
  if(length % 2 !== 0) {
     return input[Math.floor(length / 2)]; 
  } else {
    const prev = input[Math.floor(length / 2) - 1];
    const next = input[Math.floor(length / 2)];
    return (prev + next) / 2; 
  }
}
console.log(solution2([1, 2, 3, 4, 5]))
console.log(solution2([5, 6, 7, 8, 9]))
console.log(solution2([1, 2, 3, 4]))