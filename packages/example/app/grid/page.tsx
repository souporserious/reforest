import { Circle, Grid, Row, Column, Space, Text } from "./Grid"

export default async function App() {
  const response = await fetch("https://pokeapi.co/api/v2/pokemon")
  const allPokemon = (await response.json()).results

  return (
    <Grid columns={12} rows={allPokemon.length * 2 + 4}>
      <Row>
        <Space />
        <Column>
          <Space />
          <Row>
            <Space />
            <Circle size={2} color="pink" />
            <Space />
          </Row>

          {allPokemon.map((pokemon: any) => (
            <>
              <Text key={pokemon.name} size={1} length={6}>
                {pokemon.name}
              </Text>
              <Space size={1} />
            </>
          ))}

          <Row>
            <Space />
            <Circle size={2} color="orange" />
            <Space />
          </Row>
          <Space />
        </Column>
        <Space />
      </Row>
    </Grid>
  )
}
