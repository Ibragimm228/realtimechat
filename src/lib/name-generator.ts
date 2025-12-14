export const adjectives = [
  "Anonymous", "Hidden", "Secret", "Silent", "Ghost", "Shadow", "Neon", "Cyber", 
  "Quiet", "Dark", "Mystic", "Rapid", "Brave", "Calm", "Eager", "Fancy"
]

export const animals = [
  "Shark", "Panda", "Eagle", "Wolf", "Fox", "Bear", "Tiger", "Lion", 
  "Hawk", "Owl", "Falcon", "Snake", "Viper", "Cobra", "Raven", "Crow"
]

export function generateRandomName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const animal = animals[Math.floor(Math.random() * animals.length)]
  const number = Math.floor(Math.random() * 1000)
  return `${adj} ${animal} #${number}`
}
