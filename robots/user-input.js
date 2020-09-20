const readline = require('readline-sync')

function userInput(content) {
    content.searchTerm = askAndReturnSearchTerm()
    content.prefix = askAndReturnPrefix()
    content.lang = askAndReturnLang()
}

function askAndReturnSearchTerm() {
    return readline.question('Type a Wikipedia search term: ')
}

function askAndReturnPrefix() {
    const prefixes = ['Who is', 'What is', 'The history of']
    const selectedPrefixIndex = readline.keyInSelect(prefixes)
    const selectedPrefixText = prefixes[selectedPrefixIndex]

    return selectedPrefixText
}

function askAndReturnLang() {
    const langs = ['en', 'pt']
    const selectedLangIndex = readline.keyInSelect(langs)
    const selectedLangText = langs[selectedLangIndex]

    return selectedLangText
}

module.exports = userInput