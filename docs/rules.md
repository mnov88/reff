## Rule guidelines

### Be as compact as possible by avoiding repetition
```
delegados?|delegadas? --> delegad[ao]s?
```
<br>

### Be as compact as possible by preferring compact constructions
```
(?:Р|р)ешени(?:е|я) --> [Рр]ешени[ея]
```
Nb: extra care should be taken with parenthesis which can introduce unwanted capturing groups when `?:` is forgotten. So avoid them when possible. 
<br><br>

### Do not necessarily try to enumerate valid expressions only and at all costs. Cut corners when it becomes too complicated and prefer simplicity.
``` 
sprendim(?:a[si]|[ąeou])s? --> sprendim[aeiosuią]{1,3}
```
Nb: especially when there is a very distinctive beginning of word like `sprendim`. 
<br><br>

### Enforce alphabetical order when enumerating characters – non ASCII should be at the end 
```
[aeiosuią]
```
<br>

### Be careful with labels of non-ASCII characters as the uppercase/lowercase variants are not pattern matched. In the example below (BG) we need both forms for the letters `Р` and `П` since the uppercase form would not match a case-insensitive pattern. For Bulgarian, Greek and other languages not using ASCII characters we might need to list both beginning letters. 
```
[Рр]ешени[ея]     # decision
[пП]репоръка     # recommendation 
```
<br>

### No literal strings in high level construction! They must be defined in label files when language dependent or in macros. 
