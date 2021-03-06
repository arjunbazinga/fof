var time = [0]
var rewards = [0]
var avg_rewards = [0]
var probs = [0.5, 0.5]
var learning_rate = 0.25
var agent = "Random"

function updateProbs(probs, choice, learning_rate) {
    var p = [0, 0]
    p[0] = learning_rate * (1.0 - choice) + (1.0 - learning_rate) * probs[0]
    p[1] = learning_rate * choice + (1.0 - learning_rate) * probs[1]

    p[0] = p[0] / (p[0] + p[1])
    p[1] = p[1] / (p[0] + p[1])

    return p
}

function reset() {
    rewards = [0]
    avg_rewards = [0]
    time = [0]
    probs = [0.5, 0.5]
    plot(time, rewards, avg_rewards)
    document.getElementById("revealed").style.display = "none"
    document.getElementById("reveal").style.display = "block"
    document.getElementById("probs").style.display = "none"
    document.getElementById("des").value = "Describe how you think each agent works."
}

function choose(agent, probs) {
    if (agent == "Good") {
        if (probs[0] > probs[1]) {
            return 0
        } else {
            return 1
        }
        return sample(probs)
    }
    if (agent == "Evil") {
        if (probs[0] > probs[1]) {
            return 1
        } else {
            return 0
        }
    }

    if (agent == "Random") {
        return Math.round(Math.random())
    }


}

function sample(probs) {
    x = Math.random()
    if (x > probs[0]) {
        return 1
    } else {
        return 0
    }
}

function getReward(choice, ans) {
    if (choice == ans) {
        return 1
    } else {
        return -1
    }
}

function step(choice) {
    var ans = choose(agent, probs)
    console.log(ans)
    console.log(agent)
    var r = getReward(choice, ans)
    console.log(learning_rate)
    probs = updateProbs(probs, choice, learning_rate)
    document.getElementById("p").innerHTML = "[ " + probs[0].toFixed(3) + ", " + probs[1].toFixed(3) + " ]"

    rewards.push(r)
    var t = time.length + 1
    time.push(t)

    var n = avg_rewards.length
    if (n == 1) {
        var ar = r
    } else {
        var ar = (r + n * avg_rewards[n - 1]) / (n + 1)
    }
    avg_rewards.push(ar)
    plot(time, rewards, avg_rewards)


}

function plot(time, rewards, avg_rewards) {
    var ctx = document.getElementById("myChart").getContext('2d');

    var myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: time,
            datasets: [{
                    label: "Rewards",
                    data: rewards,
                    borderWidth: 1
                },

                {
                    label: "Avg Rewards",
                    data: avg_rewards,
                    borderWidth: 1,
                    borderColor: "#FF0000",
                    backgroundColor: "rgba(1,1,1,0)"
                }
            ]
        },
        options: {
            animation: {
                duration: 0
            },
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: false
                    }
                }]
            }
        }
    });

}


document.getElementById("reset").onclick = reset

document.getElementById("reveal").onclick = function () {
    document.getElementById("revealed").style.display = "block"
    document.getElementById("reveal").style.display = "none"
    document.getElementById("probs").style.display = "block"
}

document.getElementById("Agent1").onclick = function () {
    agent = "Random"
}
document.getElementById("Agent2").onclick = function () {
    agent = "Evil"
}
document.getElementById("Agent3").onclick = function () {
    agent = "Good"
}

document.getElementById("box1").onclick = function () {
    step(0)
}
document.getElementById("box2").onclick = function () {
    step(1)
}

document.getElementById("lrc").onclick = function () {
    learning_rate = parseFloat(document.getElementById("lr").value)
}


